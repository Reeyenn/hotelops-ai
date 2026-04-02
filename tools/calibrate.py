"""
HotelOps AI — Staffing Model Calibration Script

HOW TO USE:
  1. Get fingerprint machine data from Jayesh (daily clock-in/out per employee)
  2. Format it as a CSV with columns: date, employee_name, hours_worked
     Example:
       date,employee_name,hours_worked
       2026-01-20,M. CASTRO,8.5
       2026-01-20,V. GOMEZ,7.75
       ...
  3. Run: python3 tools/calibrate.py fingerprint_data.csv

OUTPUT:
  - Calibrated checkout_minutes and stayover_minutes to plug into scheduler.js
  - Outlier days flagged (possible clock gaming)
  - Day-of-week patterns
  - Full analysis saved to tools/calibration_output.txt
"""

import sys
import pandas as pd
import numpy as np
from pathlib import Path

# ─── Fixed staff names — always come, excluded from variable HK count ────────
# Update this list if staff changes. Match names as they appear in fingerprint data.
FIXED_STAFF = [
    # General Manager — covers shifts occasionally but not a variable HK
    'BRITTNEY COBBS', 'B. COBBS', 'COBBS', 'BRITTNEY',
    # Head Housekeeper — checks things, occasional work, not counted as variable HK
    # NOTE: Maria Castro sometimes logs extra hours under MARIA POSAS to avoid overtime limits.
    # POSAS hours = real cleaning work by Castro. Keep POSAS in variable pool (hours are real).
    'MARIA CASTRO',
    # Front desk staff — not housekeepers
    'KATHERINE WHITE',
    'MARY MARTINEZ',
    'MICHELLE HUMPHREY',
    'SHANEQUA HAMILTON',
    # Maintenance
    'SYLVIA MATA',
]

# Shift length in hours
SHIFT_HOURS = 8.0

# Occupancy CSV — already in the vault
OCCUPANCY_CSV = Path(__file__).parent.parent / 'tools' / 'occupancy.csv'
VAULT_OCCUPANCY = Path(__file__).parent.parent.parent / \
    'Second Brain/02 Projects/HotelOps AI/[C] Comfort Suites — Occupancy Snapshot (Dec 2025–Mar 2026).csv'

# ─── Load occupancy data ─────────────────────────────────────────────────────

def load_occupancy():
    """Load the Choice Advantage occupancy snapshot CSV."""
    path = VAULT_OCCUPANCY if VAULT_OCCUPANCY.exists() else OCCUPANCY_CSV
    df = pd.read_csv(path)
    # Clean column names (BOM character on first col)
    df.columns = [c.strip().lstrip('\ufeff') for c in df.columns]
    df['date'] = pd.to_datetime(df['IDS_DATE'], format='%m/%d/%y')
    df = df.rename(columns={'DueOut': 'checkouts', 'StayOver': 'stayovers'})
    df['checkouts'] = pd.to_numeric(df['checkouts'], errors='coerce').fillna(0).astype(int)
    df['stayovers'] = pd.to_numeric(df['stayovers'], errors='coerce').fillna(0).astype(int)
    return df[['date', 'Day', 'checkouts', 'stayovers', 'Occupied']].copy()

# ─── Load fingerprint data ───────────────────────────────────────────────────

def load_fingerprint(path):
    """
    Load fingerprint machine export.
    Expected columns: date, employee_name, hours_worked
    Flexible parser — handles common export formats.
    """
    df = pd.read_csv(path)
    df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]

    # Try to find date column
    date_col = next((c for c in df.columns if 'date' in c), None)
    name_col = next((c for c in df.columns if 'name' in c or 'employee' in c), None)
    hours_col = next((c for c in df.columns if 'hour' in c or 'total' in c or 'work' in c), None)

    if not all([date_col, name_col, hours_col]):
        print(f"Columns found: {list(df.columns)}")
        print("ERROR: Could not auto-detect columns. Expected: date, employee_name, hours_worked")
        print("Rename your CSV columns to: date, employee_name, hours_worked")
        sys.exit(1)

    df = df.rename(columns={date_col: 'date', name_col: 'employee_name', hours_col: 'hours_worked'})
    df['date'] = pd.to_datetime(df['date'], infer_datetime_format=True)
    df['hours_worked'] = pd.to_numeric(df['hours_worked'], errors='coerce').fillna(0)
    df['employee_name'] = df['employee_name'].str.upper().str.strip()
    return df[['date', 'employee_name', 'hours_worked']].copy()

# ─── Separate fixed vs variable staff ───────────────────────────────────────

def split_fixed_variable(fingerprint_df):
    """Separate fixed staff (always scheduled) from variable housekeepers."""
    is_fixed = fingerprint_df['employee_name'].apply(
        lambda name: any(f.upper() in name for f in FIXED_STAFF)
    )
    fixed = fingerprint_df[is_fixed].copy()
    variable = fingerprint_df[~is_fixed].copy()
    return fixed, variable

# ─── Build daily summary ─────────────────────────────────────────────────────

def build_daily_summary(variable_df, occupancy_df):
    """Aggregate variable HK hours per day and join with room counts."""
    daily_hk = variable_df.groupby('date').agg(
        total_hk_hours=('hours_worked', 'sum'),
        hk_headcount=('employee_name', 'nunique'),
    ).reset_index()

    merged = pd.merge(occupancy_df, daily_hk, on='date', how='inner')
    merged['total_rooms'] = merged['checkouts'] + merged['stayovers']
    return merged

# ─── Outlier detection (clock gaming) ───────────────────────────────────────

def flag_outliers(daily_df):
    """
    Flag days where hours/room ratio is suspiciously high.
    These are likely clock-gaming days and should be excluded from calibration.
    """
    daily_df = daily_df.copy()
    daily_df['hrs_per_room'] = daily_df['total_hk_hours'] / daily_df['total_rooms'].replace(0, np.nan)

    # Flag days more than 1.5 IQR above Q3 (standard outlier rule)
    q1 = daily_df['hrs_per_room'].quantile(0.25)
    q3 = daily_df['hrs_per_room'].quantile(0.75)
    iqr = q3 - q1
    threshold = q3 + 1.5 * iqr

    daily_df['is_outlier'] = daily_df['hrs_per_room'] > threshold
    daily_df['outlier_reason'] = ''
    daily_df.loc[daily_df['is_outlier'], 'outlier_reason'] = \
        f'hrs/room > {threshold:.2f} (Q3 + 1.5×IQR)'

    return daily_df, threshold

# ─── Back-calculate cleaning times ──────────────────────────────────────────

def calibrate_cleaning_times(daily_df):
    """
    Using clean (non-outlier) days, solve for checkout_minutes and stayover_minutes.

    The model: total_hk_hours × 60 = checkouts × T_co + stayovers × T_so
    With N days of data, we do a linear regression:
      y = checkouts × T_co + stayovers × T_so
    where y = total_hk_hours × 60 (minutes of work)
    """
    clean = daily_df[~daily_df['is_outlier']].copy()

    if len(clean) < 10:
        print(f"WARNING: Only {len(clean)} clean days for calibration. Results may be unreliable.")

    X = clean[['checkouts', 'stayovers']].values
    y = (clean['total_hk_hours'] * 60).values  # convert to minutes

    # Non-negative least squares — cleaning times can't be negative
    from numpy.linalg import lstsq
    coeffs, residuals, rank, sv = lstsq(X, y, rcond=None)

    checkout_min = round(coeffs[0], 1)
    stayover_min = round(coeffs[1], 1)

    return checkout_min, stayover_min, clean

# ─── Day-of-week analysis ────────────────────────────────────────────────────

def day_of_week_analysis(daily_df):
    """Show average staffing by day of week."""
    clean = daily_df[~daily_df['is_outlier']]
    dow = clean.groupby('Day').agg(
        avg_hk_headcount=('hk_headcount', 'mean'),
        avg_checkouts=('checkouts', 'mean'),
        avg_stayovers=('stayovers', 'mean'),
        avg_total_rooms=('total_rooms', 'mean'),
        days_observed=('date', 'count'),
    ).round(1)

    # Sort by day of week
    day_order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    dow = dow.reindex([d for d in day_order if d in dow.index])
    return dow

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    fingerprint_path = sys.argv[1]
    output = []

    def p(line=''):
        print(line)
        output.append(line)

    p("=" * 60)
    p("HotelOps AI — Staffing Model Calibration")
    p("=" * 60)

    # Load data
    p("\n[1] Loading data...")
    occupancy = load_occupancy()
    fingerprint = load_fingerprint(fingerprint_path)
    p(f"    Occupancy: {len(occupancy)} days ({occupancy['date'].min().date()} → {occupancy['date'].max().date()})")
    p(f"    Fingerprint: {len(fingerprint)} records, {fingerprint['employee_name'].nunique()} unique employees")
    p(f"    Employees: {', '.join(sorted(fingerprint['employee_name'].unique()))}")

    # Split fixed vs variable
    p("\n[2] Separating fixed vs variable staff...")
    fixed, variable = split_fixed_variable(fingerprint)
    p(f"    Fixed staff ({len(fixed['employee_name'].unique())}): {', '.join(sorted(fixed['employee_name'].unique()))}")
    p(f"    Variable HKs ({len(variable['employee_name'].unique())}): {', '.join(sorted(variable['employee_name'].unique()))}")
    p("    ⚠  If fixed staff list looks wrong, update FIXED_STAFF in this script and re-run.")

    # Build daily summary
    p("\n[3] Building daily summary...")
    daily = build_daily_summary(variable, occupancy)
    p(f"    Matched days: {len(daily)} (fingerprint ∩ occupancy data)")

    # Detect outliers
    p("\n[4] Detecting clock-gaming outliers...")
    daily, threshold = flag_outliers(daily)
    outliers = daily[daily['is_outlier']]
    clean_days = daily[~daily['is_outlier']]
    p(f"    Outlier threshold: {threshold:.2f} hrs/room")
    p(f"    Outlier days: {len(outliers)} flagged, {len(clean_days)} clean days kept")
    if len(outliers) > 0:
        p("\n    Flagged days (likely clock gaming or special events):")
        for _, row in outliers.iterrows():
            p(f"      {row['date'].date()} ({row['Day']}) — "
              f"{row['hk_headcount']} HKs, {row['total_hk_hours']:.1f} hrs total, "
              f"{row['checkouts']} CO + {row['stayovers']} SO = {row['total_rooms']} rooms, "
              f"{row['hrs_per_room']:.2f} hrs/room")

    # Calibrate cleaning times
    p("\n[5] Calibrating cleaning times...")
    checkout_min, stayover_min, clean = calibrate_cleaning_times(daily)
    p(f"    Calibrated checkout time:  {checkout_min} min/room  (was 30)")
    p(f"    Calibrated stayover time:  {stayover_min} min/room  (was 20)")

    # Validate: how well does the model fit?
    clean['predicted_hrs'] = (clean['checkouts'] * checkout_min + clean['stayovers'] * stayover_min) / 60
    clean['error_hrs'] = clean['predicted_hrs'] - clean['total_hk_hours']
    mae = clean['error_hrs'].abs().mean()
    p(f"\n    Model fit on {len(clean)} clean days:")
    p(f"    Mean absolute error: {mae:.2f} hrs  ({mae/SHIFT_HOURS*100:.0f}% of a shift)")

    # Day of week analysis
    p("\n[6] Day-of-week patterns...")
    dow = day_of_week_analysis(daily)
    p(dow.to_string())

    # Final recommendation
    p("\n" + "=" * 60)
    p("RESULT — Update scheduler.js with these values:")
    p("=" * 60)
    p(f"""
const CLEANING_TIMES = {{
  checkout: {checkout_min},   // calibrated from {len(clean)} days of real data
  stayover: {stayover_min},   // calibrated from {len(clean)} days of real data
}};
""")
    p("=" * 60)

    # Save output
    out_path = Path(__file__).parent / 'calibration_output.txt'
    with open(out_path, 'w') as f:
        f.write('\n'.join(output))
    p(f"\nFull output saved to: {out_path}")

if __name__ == '__main__':
    main()

"""
HotelOps AI — Timecard PDF Parser

Converts the fingerprint machine's Time Card Detail PDF report
into a CSV that calibrate.py can consume.

Usage:
  python3 tools/parse_timecard.py <path/to/timecard.pdf> [output.csv]

Output CSV columns: date, employee_name, hours_worked
"""

import sys
import re
import csv
import pdfplumber
from pathlib import Path
from datetime import datetime


# ─── Regex patterns ───────────────────────────────────────────────────────────
# Actual text from pdfplumber looks like:
#   Employee #: 1 Badge #: 1 Brittney Cobbs Hours : 290:30
#   Jan 2, 2026 Fri Hours : 08:01
#   Jan 2, 2026 TOTAL : REG : 08:01
# Note: "Hours :" has a space before the colon throughout.

# Employee header — must start with "Employee #:"
RE_EMPLOYEE = re.compile(
    r'Employee\s*#\s*:\s*\d+\s+Badge\s*#\s*:\s*\d+\s+(.+?)\s+Hours\s*:\s*[\d:]+\s*$'
)

# Day header: "Jan 2, 2026 Fri Hours : 08:01"
RE_DAY = re.compile(
    r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})'
    r'\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)'
    r'\s+Hours\s*:\s*([\d:]+)'
)

# TOTAL line: "Jan 2, 2026 TOTAL : REG : 08:01"
RE_TOTAL = re.compile(
    r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})'
    r'\s+TOTAL\s*:\s*REG\s*:\s*([\d:]+)'
)


def parse_hours(h_str):
    """Convert 'HH:MM' string to float hours. Returns 0.0 if blank/invalid."""
    h_str = h_str.strip().lstrip(':')
    if not h_str:
        return 0.0
    parts = h_str.split(':')
    try:
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
        return round(hours + minutes / 60, 4)
    except (ValueError, IndexError):
        return 0.0


def parse_date(d_str):
    """Convert 'Jan 2, 2026' to datetime. Returns None if unparseable."""
    try:
        return datetime.strptime(d_str.strip(), '%b %d, %Y')
    except ValueError:
        try:
            # Handle single-digit day without comma: 'Jan 2 2026'
            return datetime.strptime(d_str.strip(), '%b %d %Y')
        except ValueError:
            return None


def extract_records(pdf_path):
    """
    Parse a Time Card Detail PDF and return list of dicts:
      {employee_name, date (datetime), hours_worked (float)}
    """
    records = []
    current_employee = None
    # Track (employee, date) pairs already recorded to avoid duplicates
    seen = set()

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text(x_tolerance=3, y_tolerance=3)
            if not text:
                continue

            lines = text.splitlines()
            for line in lines:
                line = line.strip()
                if not line:
                    continue

                # ── Detect employee header ────────────────────────────────────
                # Look for lines that end with "Hours : NNN:NN" (the summary row)
                # and contain a name-like string
                emp_match = RE_EMPLOYEE.search(line)
                if emp_match:
                    name = emp_match.group(1).strip()
                    # Filter out false positives (lines that are just dates/times)
                    if len(name.split()) >= 1 and not any(
                        c.isdigit() for c in name[:3]
                    ):
                        current_employee = name.upper()
                    continue

                # ── Detect day header (has Hours: on same line) ───────────────
                day_match = RE_DAY.search(line)
                if day_match and current_employee:
                    date_str, hrs_str = day_match.group(1), day_match.group(2)
                    dt = parse_date(date_str)
                    hrs = parse_hours(hrs_str)
                    if dt and hrs > 0:
                        key = (current_employee, dt.date())
                        if key not in seen:
                            records.append({
                                'employee_name': current_employee,
                                'date': dt.strftime('%Y-%m-%d'),
                                'hours_worked': hrs,
                            })
                            seen.add(key)
                    continue

                # ── Fallback: TOTAL line ──────────────────────────────────────
                total_match = RE_TOTAL.search(line)
                if total_match and current_employee:
                    date_str, hrs_str = total_match.group(1), total_match.group(2)
                    dt = parse_date(date_str)
                    hrs = parse_hours(hrs_str)
                    if dt and hrs > 0:
                        key = (current_employee, dt.date())
                        if key not in seen:
                            records.append({
                                'employee_name': current_employee,
                                'date': dt.strftime('%Y-%m-%d'),
                                'hours_worked': hrs,
                            })
                            seen.add(key)

    return records


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    pdf_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else str(
        Path(pdf_path).with_suffix('.csv')
    )

    print(f"Parsing: {pdf_path}")
    records = extract_records(pdf_path)

    if not records:
        print("ERROR: No records extracted. Check PDF format.")
        sys.exit(1)

    # Sort by employee then date
    records.sort(key=lambda r: (r['employee_name'], r['date']))

    # Write CSV
    with open(out_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['date', 'employee_name', 'hours_worked'])
        writer.writeheader()
        writer.writerows(records)

    # Summary
    employees = sorted(set(r['employee_name'] for r in records))
    print(f"\n✓ Extracted {len(records)} records from {len(employees)} employees")
    print(f"  Employees: {', '.join(employees)}")
    dates = sorted(set(r['date'] for r in records))
    print(f"  Date range: {dates[0]} → {dates[-1]}")
    print(f"\n✓ Saved to: {out_path}")


if __name__ == '__main__':
    main()

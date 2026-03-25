'use client';

import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { Calculator, Clock, DollarSign, BedDouble, TrendingUp, TrendingDown, Users } from 'lucide-react';

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return h * 60 + m;
}

function minutesToDisplayTime(totalMins: number): string {
  const wrapped = ((totalMins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = Math.round(wrapped % 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

export default function StaffingPage() {
  const { lang } = useLang();
  const [occupied, setOccupied] = useState('');
  const [checkouts, setCheckouts] = useState('');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [wage, setWage] = useState('15');
  const [actualStaff, setActualStaff] = useState('');

  const calc = useMemo(() => {
    const occ = parseInt(occupied) || 0;
    if (occ <= 0) return null;

    const co = Math.min(parseInt(checkouts) || 0, occ);
    const stayovers = occ - co;
    const wg = parseFloat(wage) || 15;

    const totalMinutes = co * 35 + stayovers * 22;
    const recommended = Math.ceil(totalMinutes / 480);

    const shiftStartMins = parseTimeToMinutes(shiftStart);
    const minsPerPerson = recommended > 0 ? totalMinutes / recommended : 0;
    const finishTime = minutesToDisplayTime(shiftStartMins + minsPerPerson);

    const laborCost = recommended * 8 * wg;
    const costPerRoom = laborCost / occ;

    const actual = parseInt(actualStaff) || 0;
    let staffingStatus: { type: 'over' | 'under' | 'exact'; diff: number; extraCost: number } | null = null;

    if (actual > 0) {
      if (actual > recommended) {
        const diff = actual - recommended;
        staffingStatus = { type: 'over', diff, extraCost: diff * 8 * wg };
      } else if (actual < recommended) {
        const diff = recommended - actual;
        const hoursPerPerson = totalMinutes / actual / 60;
        const otPerPerson = Math.max(0, hoursPerPerson - 8);
        const totalOtHours = otPerPerson * actual;
        staffingStatus = { type: 'under', diff, extraCost: totalOtHours * wg * 1.5 };
      } else {
        staffingStatus = { type: 'exact', diff: 0, extraCost: 0 };
      }
    }

    return { co, stayovers, totalMinutes, recommended, finishTime, laborCost, costPerRoom, staffingStatus };
  }, [occupied, checkouts, shiftStart, wage, actualStaff]);

  return (
    <AppLayout>
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Header ── */}
        <div className="animate-in">
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {t('planningTool', lang)}
          </p>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '26px', color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={20} color="var(--amber)" />
            {t('staffingCalculatorTitle', lang)}
          </h1>
        </div>

        {/* ── Inputs ── */}
        <div className="card animate-in stagger-1">
          <p className="section-title">{t('roomInfoSection', lang)}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label className="label">{t('roomsOccupiedLabel', lang)}</label>
              <input
                className="input-mono"
                type="number"
                min="0"
                placeholder="0"
                value={occupied}
                onChange={e => setOccupied(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t('checkoutsTodayLabel', lang)}</label>
              <input
                className="input-mono"
                type="number"
                min="0"
                placeholder="0"
                value={checkouts}
                onChange={e => setCheckouts(e.target.value)}
              />
            </div>
          </div>

          {calc && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <span className="badge badge-checkout">
                <BedDouble size={10} />
                {calc.co} {lang === 'es' ? 'salidas' : 'checkouts'} · 35 min
              </span>
              <span className="badge badge-stayover">
                {calc.stayovers} {lang === 'es' ? 'continuaciones' : 'stayovers'} · 22 min
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="label">{t('shiftStartLabel', lang)}</label>
              <input
                className="input"
                type="time"
                value={shiftStart}
                onChange={e => setShiftStart(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t('hourlyWageDollar', lang)}</label>
              <input
                className="input-mono"
                type="number"
                min="0"
                step="0.5"
                placeholder="15"
                value={wage}
                onChange={e => setWage(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Empty state ── */}
        {!calc && (
          <div className="animate-in stagger-2" style={{
            textAlign: 'center', padding: '48px 20px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <Users size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {t('enterRoomsToSeeRecs', lang)}
            </p>
          </div>
        )}

        {/* ── Results ── */}
        {calc && (
          <>
            {/* Big recommended number */}
            <div className="card-amber animate-in stagger-2" style={{ textAlign: 'center', padding: '28px 16px' }}>
              <p className="stat-label" style={{ marginBottom: '10px' }}>{t('recommendedHousekeepers', lang)}</p>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '80px',
                fontWeight: 700,
                color: 'var(--amber)',
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}>
                {calc.recommended}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '10px' }}>
                {calc.totalMinutes.toLocaleString()} {lang === 'es' ? 'min total de trabajo' : 'total work min'} · {t('eightHrShifts', lang)}
              </p>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} className="animate-in stagger-3">

              <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '8px' }}>
                  <Clock size={12} color="var(--text-muted)" />
                  <span className="stat-label">{t('estimatedFinish', lang)}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {calc.finishTime}
                </div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '8px' }}>
                  <DollarSign size={12} color="var(--text-muted)" />
                  <span className="stat-label">{t('laborCost', lang)}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  ${calc.laborCost.toFixed(0)}
                </div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: '18px 12px', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '8px' }}>
                  <TrendingUp size={12} color="var(--text-muted)" />
                  <span className="stat-label">{t('costPerRoom', lang)}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '40px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                  ${calc.costPerRoom.toFixed(2)}
                </div>
              </div>
            </div>

            {/* ── Staffing comparison ── */}
            <div className="card animate-in stagger-4">
              <p className="section-title">{t('staffingComparison', lang)}</p>

              <div>
                <label className="label">{t('actualHousekeepersLabel', lang)}</label>
                <input
                  className="input-mono"
                  type="number"
                  min="1"
                  placeholder={String(calc.recommended)}
                  value={actualStaff}
                  onChange={e => setActualStaff(e.target.value)}
                />
              </div>

              {!actualStaff && (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '10px' }}>
                  {t('enterCountToSeeImpact', lang)}
                </p>
              )}

              {calc.staffingStatus?.type === 'exact' && (
                <div style={{
                  marginTop: '12px', padding: '14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.25)',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div className="dot dot-green" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green)' }}>
                    {t('staffedRight', lang)}
                  </p>
                </div>
              )}

              {calc.staffingStatus?.type === 'over' && (
                <div style={{
                  marginTop: '12px', padding: '14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--yellow-dim)', border: '1px solid rgba(234,179,8,0.25)',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}>
                  <TrendingUp size={16} color="var(--yellow)" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--yellow)', marginBottom: '2px' }}>
                      {t('overstaffedBy', lang)} {calc.staffingStatus.diff}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {t('extraLaborCost', lang)} ${calc.staffingStatus.extraCost.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              {calc.staffingStatus?.type === 'under' && (
                <div style={{
                  marginTop: '12px', padding: '14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.25)',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}>
                  <TrendingDown size={16} color="var(--red)" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--red)', marginBottom: '2px' }}>
                      {t('understaffedBy', lang)} {calc.staffingStatus.diff}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {t('estimatedOvertime', lang)} ${calc.staffingStatus.extraCost.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </AppLayout>
  );
}

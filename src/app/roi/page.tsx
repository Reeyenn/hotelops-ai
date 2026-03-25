'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { AppLayout } from '@/components/layout/AppLayout';
import { getRecentDailyLogs } from '@/lib/firestore';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { calcROI } from '@/lib/calculations';
import type { DailyLog } from '@/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, startOfMonth } from 'date-fns';
import { TrendingUp, DollarSign, Zap } from 'lucide-react';

const MONTHLY_PRICE = 250; // HotelOps AI subscription price

export default function ROIPage() {
  const { user } = useAuth();
  const { activePropertyId, activeProperty } = useProperty();
  const { lang } = useLang();

  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !activePropertyId) return;
    (async () => {
      const data = await getRecentDailyLogs(user.uid, activePropertyId, 365);
      setLogs(data);
      setLoading(false);
    })();
  }, [user, activePropertyId]);

  const totalSaved = logs.reduce((s, l) => s + (l.laborSaved ?? 0), 0);
  const totalCost = logs.reduce((s, l) => s + (l.laborCost ?? 0), 0);

  // Months tracked
  const uniqueMonths = new Set(logs.map(l => l.date.slice(0, 7))).size;
  const totalPaid = uniqueMonths * MONTHLY_PRICE;
  const roi = calcROI(totalSaved, MONTHLY_PRICE, uniqueMonths);

  // Monthly breakdown
  const byMonth: Record<string, { saved: number; cost: number; rooms: number }> = {};
  logs.forEach(l => {
    const month = l.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { saved: 0, cost: 0, rooms: 0 };
    byMonth[month].saved += l.laborSaved ?? 0;
    byMonth[month].cost += l.laborCost ?? 0;
    byMonth[month].rooms += l.checkouts + l.stayovers;
  });

  const monthlyData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month: format(parseISO(`${month}-01`), 'MMM'),
      saved: Math.round(data.saved),
      cost: Math.round(data.cost),
    }));

  // Per-room cost
  const perRoomData = logs
    .filter(l => l.checkouts + l.stayovers > 0)
    .map(l => ({
      date: format(parseISO(l.date), 'M/d'),
      perRoom: parseFloat(((l.laborCost ?? 0) / (l.checkouts + l.stayovers)).toFixed(2)),
    }))
    .slice(-14);

  const tooltipStyle = { background: '#111d2e', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--amber)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={26} color="var(--amber)" />
            ROI Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>{activeProperty?.name}</p>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <TrendingUp size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Complete daily setups to track your ROI here.</p>
          </div>
        ) : (
          <>
            {/* Hero — total saved */}
            <div
              className="card card-green"
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                marginBottom: '16px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(34,197,94,0.7)', marginBottom: '8px' }}>
                {t('totalSaved', lang)}
              </p>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 900,
                  fontSize: 'clamp(52px, 14vw, 100px)',
                  color: '#22c55e',
                  lineHeight: 1,
                  textShadow: '0 0 60px rgba(34,197,94,0.4)',
                }}
              >
                {formatCurrency(totalSaved)}
              </div>
              <p style={{ fontSize: '14px', color: 'rgba(34,197,94,0.7)', marginTop: '8px' }}>
                in labor costs since you started
              </p>
            </div>

            {/* ROI breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <p className="label">Total Paid to HotelOps AI</p>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.4rem', color: 'var(--text-secondary)', lineHeight: 1 }}>
                  {formatCurrency(totalPaid)}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{uniqueMonths} months × ${MONTHLY_PRICE}/mo</p>
              </div>
              <div className="card" style={{ padding: '16px', textAlign: 'center', borderColor: roi >= 5 ? 'rgba(34,197,94,0.3)' : 'var(--border)' }}>
                <p className="label">Return on Investment</p>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.4rem', color: roi >= 5 ? '#22c55e' : 'var(--amber)', lineHeight: 1 }}>
                  {roi > 0 ? `${roi.toFixed(1)}x` : '—'}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>return</p>
              </div>
            </div>

            {/* ROI statement */}
            {roi > 0 && (
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(212,144,64,0.06)',
                  border: '1px solid rgba(212,144,64,0.2)',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <Zap size={16} color="var(--amber)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  You've paid <strong style={{ color: 'var(--amber)' }}>{formatCurrency(totalPaid)}</strong> for HotelOps AI and saved{' '}
                  <strong style={{ color: '#22c55e' }}>{formatCurrency(totalSaved)}</strong> in labor costs. That's a{' '}
                  <strong style={{ color: '#22c55e' }}>{roi.toFixed(1)}x return</strong>.
                  {roi >= 10 && ' 🎉'}
                </p>
              </div>
            )}

            {/* Monthly chart */}
            {monthlyData.length > 0 && (
              <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
                <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                  Monthly Labor Saved
                </p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={monthlyData}>
                    <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatCurrency(v), 'Saved']} />
                    <Bar dataKey="saved" fill="#22c55e" radius={[4, 4, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly table */}
            {Object.entries(byMonth).length > 0 && (
              <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                <p className="label" style={{ marginBottom: '12px' }}>Monthly Breakdown</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Month', 'Saved', 'Labor Cost', 'Rooms'].map(h => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).map(([month, data]) => (
                        <tr key={month} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 8px', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {format(parseISO(`${month}-01`), 'MMM yyyy')}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#22c55e', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {formatCurrency(data.saved)}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {formatCurrency(data.cost)}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {data.rooms}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Per-room cost chart */}
            {perRoomData.length > 2 && (
              <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
                <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Labor Cost Per Room
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  The metric hotel operators track obsessively
                </p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={perRoomData}>
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v}`, '$/room']} />
                    <Bar dataKey="perRoom" fill="rgba(212,144,64,0.7)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

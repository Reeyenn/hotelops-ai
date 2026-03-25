'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { AppLayout } from '@/components/layout/AppLayout';
import { getRecentDailyLogs, subscribeToRooms } from '@/lib/firestore';
import { formatCurrency } from '@/lib/utils';
import type { DailyLog, Room } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { BarChart3, AlertTriangle, Users, Copy, Check } from 'lucide-react';

// ─── Timestamp helper (Firestore Timestamp or Date) ─────────────────────────
function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate();
  }
  const d = new Date(ts as string | number | Date);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Per-housekeeper performance ─────────────────────────────────────────────
interface HKPerf {
  staffId: string;
  name: string;
  roomsCleaned: number;
  avgCleanMinutes: number | null;   // null = no completed rooms with both timestamps
  shiftStart: Date | null;
  shiftEnd: Date | null;
  efficiencyRoomsPerHr: number | null;
}

function buildPerformance(rooms: Room[]): HKPerf[] {
  // Group all rooms (assigned) by staffId
  const byStaff = new Map<string, { name: string; rooms: Room[] }>();
  for (const r of rooms) {
    if (!r.assignedTo) continue;
    if (!byStaff.has(r.assignedTo)) {
      byStaff.set(r.assignedTo, { name: r.assignedName ?? r.assignedTo, rooms: [] });
    }
    byStaff.get(r.assignedTo)!.rooms.push(r);
  }

  const results: HKPerf[] = [];

  for (const [staffId, { name, rooms: hkRooms }] of byStaff) {
    const cleaned = hkRooms.filter(r => r.status === 'clean' || r.status === 'inspected');

    // Avg clean time: only rooms with both startedAt and completedAt
    const timed = cleaned
      .map(r => {
        const s = toDate(r.startedAt);
        const e = toDate(r.completedAt);
        if (!s || !e) return null;
        return (e.getTime() - s.getTime()) / 60_000; // minutes
      })
      .filter((m): m is number => m !== null && m > 0);

    const avgCleanMinutes = timed.length > 0
      ? Math.round(timed.reduce((a, b) => a + b, 0) / timed.length)
      : null;

    // Shift window: earliest startedAt → latest completedAt across all hk rooms
    const starts = hkRooms.map(r => toDate(r.startedAt)).filter((d): d is Date => d !== null);
    const ends   = cleaned.map(r => toDate(r.completedAt)).filter((d): d is Date => d !== null);

    const shiftStart = starts.length > 0 ? new Date(Math.min(...starts.map(d => d.getTime()))) : null;
    const shiftEnd   = ends.length   > 0 ? new Date(Math.max(...ends.map(d => d.getTime())))   : null;

    // Efficiency: rooms cleaned / shift hours
    let efficiencyRoomsPerHr: number | null = null;
    if (shiftStart && shiftEnd && cleaned.length > 0) {
      const hrs = (shiftEnd.getTime() - shiftStart.getTime()) / 3_600_000;
      if (hrs > 0) efficiencyRoomsPerHr = Math.round((cleaned.length / hrs) * 10) / 10;
    }

    results.push({ staffId, name, roomsCleaned: cleaned.length, avgCleanMinutes, shiftStart, shiftEnd, efficiencyRoomsPerHr });
  }

  return results.sort((a, b) => b.roomsCleaned - a.roomsCleaned);
}

function fmtDuration(start: Date, end: Date): string {
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const ini = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
      background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px',
      color: 'var(--amber)', letterSpacing: '0.02em',
    }}>
      {ini}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { user }                             = useAuth();
  const { activeProperty, activePropertyId, staff } = useProperty();
  const { lang }                             = useLang();

  const [logs,    setLogs]    = useState<DailyLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [rooms,   setRooms]   = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'performance'>('analytics');
  const [copied,  setCopied]  = useState(false);

  // Load daily logs (analytics tab)
  useEffect(() => {
    if (!user || !activePropertyId) return;
    (async () => {
      const data = await getRecentDailyLogs(user.uid, activePropertyId, 60);
      setLogs(data);
      setLogsLoading(false);
    })();
  }, [user, activePropertyId]);

  // Subscribe to today's rooms (performance tab) — always live
  useEffect(() => {
    if (!user || !activePropertyId) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const unsub = subscribeToRooms(user.uid, activePropertyId, today, setRooms);
    return unsub;
  }, [user, activePropertyId]);

  const loading = logsLoading;

  if (loading) {
    return (
      <AppLayout>
        <div style={{ padding: '48px 16px', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: '34px', height: '34px' }} />
        </div>
      </AppLayout>
    );
  }

  /* ── Analytics tab: derived metrics ── */
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDay = Array.from({ length: 7 }, (_, i) => {
    const dl = logs.filter(l => parseISO(l.date).getDay() === i);
    return {
      day: dayLabels[i],
      avgStaff:    dl.length ? parseFloat((dl.reduce((s, l) => s + l.recommendedStaff, 0) / dl.length).toFixed(1)) : 0,
      avgOccupied: dl.length ? Math.round(dl.reduce((s, l) => s + l.occupied, 0) / dl.length) : 0,
    };
  });

  const last14 = [...logs].reverse().slice(-14).map(l => ({
    date:       format(parseISO(l.date), 'M/d'),
    efficiency: l.actualStaff > 0 ? Math.round((l.recommendedStaff / l.actualStaff) * 100) : 100,
    saved:      Math.round(l.laborSaved ?? 0),
  }));

  const anomalies  = logs.filter(l => l.actualStaff > l.recommendedStaff + 1).slice(0, 5);
  const totalSaved = logs.reduce((s, l) => s + (l.laborSaved ?? 0), 0);
  const avgStaff   = logs.length ? (logs.reduce((s, l) => s + l.recommendedStaff, 0) / logs.length).toFixed(1) : '—';
  const eligible   = logs.filter(l => l.actualStaff > 0);
  const avgEff     = eligible.length
    ? Math.round(eligible.reduce((s, l) => s + (l.recommendedStaff / l.actualStaff) * 100, 0) / eligible.length)
    : 100;

  /* ── Turnaround chart data ── */
  const turnaroundData = [...logs]
    .reverse()
    .slice(-14)
    .filter(l => l.avgTurnaroundMinutes && l.avgTurnaroundMinutes > 0)
    .map(l => ({ date: format(parseISO(l.date), 'M/d'), mins: l.avgTurnaroundMinutes }));

  /* ── Performance tab: derived metrics ── */
  const perfs = buildPerformance(rooms);

  /* ── Today's turnaround from live rooms ── */
  const todayTurnaround = (() => {
    const timed = rooms
      .filter(r => r.startedAt && r.completedAt)
      .map(r => {
        const s = toDate(r.startedAt); const e = toDate(r.completedAt);
        if (!s || !e) return null;
        return (e.getTime() - s.getTime()) / 60_000;
      })
      .filter((m): m is number => m !== null && m > 0);
    return timed.length > 0 ? Math.round(timed.reduce((a, b) => a + b, 0) / timed.length) : null;
  })();

  const todayDone = rooms.filter(r => r.status === 'clean' || r.status === 'inspected').length;

  /* ── Copy end-of-day report ── */
  function copyReport() {
    const date    = format(new Date(), 'MMM d, yyyy');
    const prop    = activeProperty?.name ?? 'Property';
    const lines   = [
      `HotelOps AI — Daily Report`,
      `${prop} · ${date}`,
      ``,
      `Rooms: ${todayDone}/${rooms.length} complete`,
      todayTurnaround ? `Avg turnaround: ${todayTurnaround} min` : '',
      ``,
      `Housekeepers:`,
      ...perfs.map(p =>
        `• ${p.name} — ${p.roomsCleaned} room${p.roomsCleaned !== 1 ? 's' : ''}` +
        (p.avgCleanMinutes ? `, ${p.avgCleanMinutes} min avg` : '') +
        (p.efficiencyRoomsPerHr ? `, ${p.efficiencyRoomsPerHr}/hr` : '')
      ),
      ``,
      `Generated by HotelOps AI`,
    ].filter(l => l !== undefined && l !== null) as string[];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Staff with no rooms assigned today (scheduled staff not in perf list)
  const scheduledToday = staff.filter(s => s.scheduledToday);
  const unassigned = scheduledToday.filter(s => !perfs.find(p => p.staffId === s.id));

  const tipStyle = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)',
    borderRadius: '10px', fontSize: '13px', fontFamily: 'var(--font-sans)',
  };

  return (
    <AppLayout>
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── Header ── */}
        <div className="animate-in">
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {activeTab === 'analytics' ? `Last ${logs.length} days tracked` : `Today · ${format(new Date(), 'MMM d')}`}
          </p>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '26px', color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeTab === 'analytics'
              ? <><BarChart3 size={18} color="var(--amber)" />{t('analytics', lang)}</>
              : <><Users size={18} color="var(--amber)" />Performance</>
            }
          </h1>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['analytics', 'performance'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`chip${activeTab === tab ? ' chip-active' : ''}`}
              style={{ height: '30px', paddingLeft: '14px', paddingRight: '14px', cursor: 'pointer' }}
            >
              {tab === 'analytics' ? 'Analytics' : 'Performance'}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            ANALYTICS TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          logs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '52px 20px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '16px', margin: '0 auto 14px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BarChart3 size={28} color="var(--text-muted)" />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500, lineHeight: 1.5 }}>
                No data yet. Complete your first morning setup to start seeing analytics.
              </p>
            </div>
          ) : (
            <>
              {/* ── Summary metric chips ── */}
              <div
                className="animate-in stagger-1"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}
              >
                {[
                  { label: 'Total Saved',      value: formatCurrency(totalSaved), color: 'var(--green)' },
                  { label: 'Avg Housekeepers', value: String(avgStaff),           color: 'var(--amber)' },
                  { label: 'Labor Efficiency', value: `${avgEff}%`,               color: avgEff <= 100 ? 'var(--green)' : 'var(--red)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', padding: '16px 10px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.45rem', color, lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {value}
                    </div>
                    <div className="label" style={{ marginTop: '7px', marginBottom: 0 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* ── Efficiency line chart ── */}
              {last14.length > 2 && (
                <div className="card animate-in stagger-2" style={{ padding: '20px' }}>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '3px' }}>Labor Efficiency</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Last {last14.length} days · 100% = perfectly staffed
                  </p>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={last14}>
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis hide domain={[50, 150]} />
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v}%`, 'Efficiency']} />
                      <Line type="monotone" dataKey="efficiency" stroke="var(--amber)" strokeWidth={2.5}
                        dot={{ fill: 'var(--amber)', r: 3 }}
                        activeDot={{ r: 5, fill: 'var(--amber)', stroke: 'var(--bg)', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Labor saved last 7 days ── */}
              {last14.length > 0 && (
                <div className="card animate-in stagger-3" style={{ padding: '20px' }}>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                    Labor Saved per Day
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Last {Math.min(last14.length, 7)} days
                  </p>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={last14.slice(-7)} barCategoryGap="30%">
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={tipStyle} formatter={(v: number) => [formatCurrency(v), 'Saved']} />
                      <Bar dataKey="saved" fill="var(--green)" radius={[5, 5, 0, 0]} opacity={0.9} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Avg turnaround time chart ── */}
              {turnaroundData.length > 1 && (
                <div className="card animate-in stagger-3" style={{ padding: '20px' }}>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                    Avg Room Turnaround Time
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Last {turnaroundData.length} days with data · minutes per room
                  </p>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={turnaroundData}>
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis hide domain={['auto', 'auto']} />
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v} min`, 'Avg Turnaround']} />
                      <Line
                        type="monotone" dataKey="mins" stroke="var(--green)" strokeWidth={2.5}
                        dot={{ fill: 'var(--green)', r: 3 }}
                        activeDot={{ r: 5, fill: 'var(--green)', stroke: 'var(--bg)', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Avg housekeepers by day ── */}
              <div className="card animate-in stagger-3" style={{ padding: '20px' }}>
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                  Avg Housekeepers by Day
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Day-of-week staffing pattern</p>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={byDay} barCategoryGap="30%">
                    <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={tipStyle} formatter={(v: number) => [v, 'Avg HKs']} />
                    <Bar dataKey="avgStaff" fill="var(--amber)" radius={[5, 5, 0, 0]} opacity={0.9} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ── Avg occupied rooms by day ── */}
              <div className="card animate-in stagger-3" style={{ padding: '20px' }}>
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                  Avg Occupied Rooms by Day
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Historical occupancy pattern</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={byDay} barCategoryGap="30%">
                    <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={tipStyle} formatter={(v: number) => [v, 'Avg Occupied']} />
                    <Bar dataKey="avgOccupied" fill="rgba(212,144,64,0.50)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ── Overstaffing incidents ── */}
              {anomalies.length > 0 && (
                <div
                  className="card animate-in stagger-4"
                  style={{ padding: '18px', borderColor: 'rgba(234,179,8,0.2)', borderWidth: '1.5px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '9px',
                      background: 'var(--yellow-dim)', border: '1px solid rgba(234,179,8,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <AlertTriangle size={16} color="var(--yellow)" />
                    </div>
                    <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--yellow)' }}>Overstaffing Incidents</p>
                  </div>
                  {anomalies.map((l, i) => {
                    const overage = l.actualStaff - l.recommendedStaff;
                    const wasted  = overage * (l.hourlyWage ?? activeProperty?.hourlyWage ?? 15) * 8;
                    return (
                      <div key={l.date} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                        padding: '11px 0',
                        borderBottom: i < anomalies.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px' }}>
                            {format(parseISO(l.date), 'MMM d')}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                            {l.actualStaff} scheduled, {l.recommendedStaff} needed
                          </span>
                        </div>
                        <span style={{ color: 'var(--red)', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          −{formatCurrency(wasted)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PERFORMANCE TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'performance' && (
          <>
            {/* ── Summary chips ── */}
            {perfs.length > 0 && (
              <div
                className="animate-in stagger-1"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}
              >
                {[
                  {
                    label: 'Rooms Done',
                    value: String(perfs.reduce((s, p) => s + p.roomsCleaned, 0)),
                    color: 'var(--green)',
                  },
                  {
                    label: 'Active HKs',
                    value: String(perfs.filter(p => p.roomsCleaned > 0).length),
                    color: 'var(--amber)',
                  },
                  {
                    label: 'Avg Efficiency',
                    value: (() => {
                      const effs = perfs.filter(p => p.efficiencyRoomsPerHr !== null).map(p => p.efficiencyRoomsPerHr!);
                      return effs.length > 0
                        ? `${(effs.reduce((a, b) => a + b, 0) / effs.length).toFixed(1)}/hr`
                        : '—';
                    })(),
                    color: 'var(--amber)',
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', padding: '16px 10px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.45rem', color, lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {value}
                    </div>
                    <div className="label" style={{ marginTop: '7px', marginBottom: 0 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── No rooms at all today ── */}
            {perfs.length === 0 && unassigned.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '52px 20px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '16px', margin: '0 auto 14px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Users size={28} color="var(--text-muted)" />
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500, lineHeight: 1.5 }}>
                  No room assignments yet today. Assign rooms on the Rooms page to start tracking.
                </p>
              </div>
            )}

            {/* ── Housekeeper cards ── */}
            {perfs.map((p, i) => (
              <div
                key={p.staffId}
                className={`card animate-in stagger-${Math.min(i + 1, 4)}`}
                style={{ padding: '16px' }}
              >
                {/* Row 1: avatar + name + rooms count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Initials name={p.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </p>
                    {p.shiftStart && p.shiftEnd ? (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {format(p.shiftStart, 'h:mm a')} → {format(p.shiftEnd, 'h:mm a')} · {fmtDuration(p.shiftStart, p.shiftEnd)}
                      </p>
                    ) : p.shiftStart ? (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Started {format(p.shiftStart, 'h:mm a')} · in progress
                      </p>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '24px', color: 'var(--green)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {p.roomsCleaned}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      rooms
                    </div>
                  </div>
                </div>

                {/* Row 2: stat pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <StatPill
                    label="Avg time"
                    value={p.avgCleanMinutes !== null ? `${p.avgCleanMinutes} min` : '—'}
                  />
                  <StatPill
                    label="Efficiency"
                    value={p.efficiencyRoomsPerHr !== null ? `${p.efficiencyRoomsPerHr}/hr` : '—'}
                    highlight={p.efficiencyRoomsPerHr !== null}
                  />
                </div>
              </div>
            ))}

            {/* ── Today's Report / End-of-Day Summary ── */}
            {(todayDone > 0 || perfs.length > 0) && (
              <div className="card animate-in" style={{ padding: '18px', borderColor: 'rgba(34,197,94,0.18)', borderWidth: '1.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                    Today's Report
                  </p>
                  <button
                    onClick={copyReport}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 13px', borderRadius: 'var(--radius-full)',
                      background: copied ? 'var(--green-dim)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${copied ? 'var(--green-border)' : 'var(--border-bright)'}`,
                      cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                      color: copied ? 'var(--green)' : 'var(--text-secondary)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {copied
                      ? <><Check size={13} />Copied</>
                      : <><Copy size={13} />Copy Report</>
                    }
                  </button>
                </div>

                {/* Summary row */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div style={{
                    flex: 1, minWidth: '100px', padding: '12px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '22px', color: 'var(--green)', lineHeight: 1 }}>
                      {todayDone}/{rooms.length}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Rooms Done
                    </div>
                  </div>
                  {todayTurnaround !== null && (
                    <div style={{
                      flex: 1, minWidth: '100px', padding: '12px', borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '22px', color: 'var(--amber)', lineHeight: 1 }}>
                        {todayTurnaround}m
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Avg Turnover
                      </div>
                    </div>
                  )}
                </div>

                {/* Per-housekeeper breakdown */}
                {perfs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {perfs.map((p, i) => (
                      <div key={p.staffId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: i < perfs.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>{p.name}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700,
                            color: 'var(--green)',
                          }}>
                            {p.roomsCleaned} {p.roomsCleaned === 1 ? 'room' : 'rooms'}
                          </span>
                          {p.avgCleanMinutes !== null && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {p.avgCleanMinutes} min avg
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Scheduled staff with no activity ── */}
            {unassigned.length > 0 && (
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  No activity today
                </p>
                {unassigned.map((s, i) => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 0',
                    borderBottom: i < unassigned.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <Initials name={s.name} />
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>{s.name}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </AppLayout>
  );
}

// ─── Tiny stat pill ──────────────────────────────────────────────────────────
function StatPill({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '5px 10px', borderRadius: 'var(--radius-full)',
      background: highlight ? 'var(--amber-dim)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${highlight ? 'var(--amber-border)' : 'var(--border)'}`,
    }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
        color: highlight ? 'var(--amber)' : 'var(--text-secondary)',
      }}>
        {value}
      </span>
    </div>
  );
}

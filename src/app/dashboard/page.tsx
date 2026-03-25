'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { AppLayout } from '@/components/layout/AppLayout';
import { subscribeToRooms, getDailyLog, getRecentDailyLogs } from '@/lib/firestore';
import { formatCurrency, todayStr } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Room, DailyLog } from '@/types';
import { format } from 'date-fns';
import { BedDouble, Clock, DollarSign, TrendingUp, Sun, ChevronRight, ArrowRight, Bell, Users, Package, BookOpen, Monitor } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeProperty, activePropertyId, loading: propLoading } = useProperty();
  const router = useRouter();
  const { lang } = useLang();

  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [todayLog,   setTodayLog]   = useState<DailyLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);

  useEffect(() => {
    if (!authLoading && !propLoading && !user) router.replace('/signin');
    if (!authLoading && !propLoading && user && !activePropertyId) router.replace('/onboarding');
  }, [user, authLoading, propLoading, activePropertyId, router]);

  useEffect(() => {
    if (!user || !activePropertyId) return;
    return subscribeToRooms(user.uid, activePropertyId, todayStr(), setRooms);
  }, [user, activePropertyId]);

  useEffect(() => {
    if (!user || !activePropertyId) return;
    (async () => {
      const [log, recent] = await Promise.all([
        getDailyLog(user.uid, activePropertyId, todayStr()),
        getRecentDailyLogs(user.uid, activePropertyId, 30),
      ]);
      setTodayLog(log);
      setRecentLogs(recent);
    })();
  }, [user, activePropertyId]);

  const clean      = rooms.filter(r => r.status === 'clean' || r.status === 'inspected').length;
  const inProgress = rooms.filter(r => r.status === 'in_progress').length;
  const dirty      = rooms.filter(r => r.status === 'dirty').length;
  const total      = rooms.length;
  const progress   = total > 0 ? Math.round((clean / total) * 100) : 0;

  const weekLogs   = recentLogs.slice(0, 7);
  const weekSaved  = weekLogs.reduce((s, l) => s + (l.laborSaved ?? 0), 0);
  const monthLogs  = recentLogs.slice(0, 30);
  const monthSaved = monthLogs.reduce((s, l) => s + (l.laborSaved ?? 0), 0);

  const chartData  = [...recentLogs].reverse().slice(-14).map(l => ({
    date:  format(new Date(l.date), 'M/d'),
    saved: Math.round(l.laborSaved ?? 0),
  }));

  const weekCost   = weekLogs.reduce((s, l) => s + (l.laborCost ?? 0), 0);
  const weekBudget = activeProperty?.weeklyBudget ?? 0;
  const budgetPct  = weekBudget > 0 ? Math.min((weekCost / weekBudget) * 100, 100) : 0;

  if (authLoading || propLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>

        {/* ── Page header ── */}
        <div className="animate-in" style={{ padding: '8px 0 16px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '26px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {t('dashboard', lang)}
            </h1>
            {activeProperty && (
              <span style={{ color: 'var(--amber)', fontSize: '12px', fontWeight: 500 }}>
                {activeProperty.name}
              </span>
            )}
          </div>
        </div>

        {/* ── Room stats row ── */}
        <div className="animate-in stagger-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
          {[
            { label: t('clean', lang),      count: clean,      dotClass: 'dot-green',  color: 'var(--green)'  },
            { label: t('inProgress', lang), count: inProgress, dotClass: 'dot-yellow', color: 'var(--yellow)' },
            { label: t('dirty', lang),      count: dirty,      dotClass: 'dot-red',    color: 'var(--red)'    },
          ].map(({ label, count, dotClass, color }) => (
            <div key={label} className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '6px' }}>
                <span className={`dot ${dotClass}`} />
                <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {label}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '32px', color, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {count}
              </div>
            </div>
          ))}
        </div>

        {/* ── Progress bar (only when rooms exist) ── */}
        {total > 0 && (
          <div className="card-flat animate-in stagger-1" style={{ padding: '12px 14px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{clean} of {total} rooms complete</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', color: progress === 100 ? 'var(--green)' : 'var(--amber)' }}>
                {progress}%
              </span>
            </div>
            <div className="progress-track progress-track-lg">
              <div className="progress-fill" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--green)' : 'var(--amber)' }} />
            </div>
          </div>
        )}

        {/* ── Morning setup CTA or today log ── */}
        {todayLog ? (
          <div className="card-amber animate-in stagger-2" style={{ marginBottom: '8px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '12px' }}>
              Today&apos;s Schedule
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { icon: BedDouble,  label: t('housekeepers', lang),    value: String(todayLog.recommendedStaff),        color: 'var(--amber)' },
                { icon: Clock,      label: t('estimatedFinish', lang),  value: todayLog.completionTime || '—',            color: 'var(--text-primary)' },
                { icon: DollarSign, label: t('laborCost', lang),        value: formatCurrency(todayLog.laborCost ?? 0),  color: 'var(--text-primary)' },
                { icon: TrendingUp, label: t('laborSaved', lang),       value: formatCurrency(todayLog.laborSaved ?? 0), color: 'var(--green)' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={14} color="var(--text-muted)" />
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '16px', color, letterSpacing: '-0.01em' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Link href="/morning-setup" style={{ textDecoration: 'none', display: 'block', marginBottom: '8px' }} className="animate-in stagger-2">
            <div style={{
              background: 'var(--amber-dim)',
              border: '1px solid var(--amber-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              display: 'flex', alignItems: 'center', gap: '14px',
              cursor: 'pointer',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: 'var(--radius-md)', flexShrink: 0,
                background: 'var(--amber)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sun size={20} color="#0A0A0A" strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                  Start morning setup
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Calculate today&apos;s schedule
                </p>
              </div>
              <ArrowRight size={16} color="var(--amber)" />
            </div>
          </Link>
        )}

        {/* ── Savings row ── */}
        <div className="animate-in stagger-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {[
            { label: t('thisWeek', lang),  value: formatCurrency(weekSaved)  },
            { label: t('thisMonth', lang), value: formatCurrency(monthSaved) },
          ].map(({ label, value }) => (
            <div key={label} className="card">
              <p className="stat-label" style={{ marginBottom: '6px' }}>{label}</p>
              <div className="stat-number" style={{ fontSize: '28px', color: 'var(--green)' }}>{value}</div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>labor saved</p>
            </div>
          ))}
        </div>

        {/* ── Weekly budget ── */}
        {weekBudget > 0 && (
          <div className="card animate-in stagger-3" style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Weekly Budget</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600,
                color: budgetPct > 90 ? 'var(--red)' : budgetPct > 75 ? 'var(--yellow)' : 'var(--green)',
              }}>
                {formatCurrency(weekCost)} / {formatCurrency(weekBudget)}
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{
                width: `${budgetPct}%`,
                background: budgetPct > 90 ? 'var(--red)' : budgetPct > 75 ? 'var(--yellow)' : 'var(--green)',
              }} />
            </div>
          </div>
        )}

        {/* ── Chart ── */}
        {chartData.length > 2 && (
          <div className="card animate-in stagger-3" style={{ marginBottom: '8px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Daily Savings — Last {chartData.length} Days
            </p>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  formatter={(v: number) => [formatCurrency(v), 'Saved']}
                />
                <Line type="monotone" dataKey="saved" stroke="var(--green)" strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--green)', stroke: 'var(--bg)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Room queue link ── */}
        <Link href="/rooms" style={{ textDecoration: 'none', display: 'block', marginBottom: '8px' }} className="animate-in stagger-4">
          <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BedDouble size={16} color="var(--text-muted)" />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>Room Priority Queue</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>{dirty + inProgress} rooms remaining</p>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </Link>

        {/* ── Quick access grid ── */}
        <div className="animate-in stagger-4" style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Operations
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {[
              { href: '/requests',  icon: Bell,     label: 'Guest Requests', sub: 'Track room requests'      },
              { href: '/staff',     icon: Users,    label: 'Staff Roster',   sub: 'Manage housekeepers'      },
              { href: '/inventory', icon: Package,  label: 'Inventory',      sub: 'Par levels & supplies'    },
              { href: '/logbook',   icon: BookOpen, label: 'Shift Logbook',  sub: 'Handoff notes'            },
              { href: '/ops-wall',  icon: Monitor,  label: 'Ops Wall',       sub: 'Live room status display' },
            ].map(({ href, icon: Icon, label, sub }) => (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '9px',
                    background: 'rgba(212,144,64,0.1)', border: '1px solid var(--amber-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={15} color="var(--amber)" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

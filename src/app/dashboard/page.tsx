'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { AppLayout } from '@/components/layout/AppLayout';
import { subscribeToRooms, subscribeToShiftConfirmations } from '@/lib/firestore';
import { todayStr } from '@/lib/utils';
import type { Room, ShiftConfirmation, ConfirmationStatus } from '@/types';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dt.toLocaleDateString('en-CA');
}

const STATUS_COLOR: Record<ConfirmationStatus, string> = {
  pending:     'var(--amber)',
  confirmed:   'var(--green)',
  declined:    'var(--red)',
  no_response: 'var(--text-muted)',
};

const STATUS_ICON: Record<ConfirmationStatus, React.ReactNode> = {
  pending:     <Clock size={13} />,
  confirmed:   <CheckCircle2 size={13} />,
  declined:    <XCircle size={13} />,
  no_response: <AlertTriangle size={13} />,
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeProperty, activePropertyId, loading: propLoading } = useProperty();
  const { lang } = useLang();
  const router = useRouter();

  const [rooms,          setRooms]          = useState<Room[]>([]);
  const [tomorrowConfs,  setTomorrowConfs]  = useState<ShiftConfirmation[]>([]);

  const tomorrow = addDays(todayStr(), 1);

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
    return subscribeToShiftConfirmations(user.uid, activePropertyId, tomorrow, setTomorrowConfs);
  }, [user, activePropertyId, tomorrow]);

  const clean      = rooms.filter(r => r.status === 'clean' || r.status === 'inspected').length;
  const inProgress = rooms.filter(r => r.status === 'in_progress').length;
  const dirty      = rooms.filter(r => r.status === 'dirty').length;
  const total      = rooms.length;

  if (authLoading || propLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  const confirmedCount = tomorrowConfs.filter(c => c.status === 'confirmed').length;
  const pendingCount   = tomorrowConfs.filter(c => c.status === 'pending').length;

  return (
    <AppLayout>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Header ── */}
        <div className="animate-in" style={{ padding: '8px 0 4px' }}>
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

        {/* ── Room status ── */}
        <div className="animate-in stagger-1">
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
            {t('housekeeping', lang)}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {/* Total */}
            <div className="card" style={{ padding: '16px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t('rooms', lang)}
              </p>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '48px', lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--amber)' }}>
                {total}
              </div>
              {total > 0 && (
                <>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', margin: '12px 0 8px' }}>
                    <div style={{ width: `${total > 0 ? Math.round((clean / total) * 100) : 0}%`, height: '100%', background: 'var(--green)', borderRadius: '2px', transition: 'width 400ms' }} />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {Math.round((clean / total) * 100)}% {t('complete', lang).toLowerCase()}
                  </p>
                </>
              )}
            </div>

            {[
              { label: t('clean', lang),      count: clean,      color: 'var(--green)',  dot: 'dot-green'  },
              { label: t('inProgress', lang), count: inProgress, color: 'var(--yellow)', dot: 'dot-yellow' },
              { label: t('dirty', lang),      count: dirty,      color: 'var(--red)',    dot: 'dot-red'    },
            ].map(({ label, count, color, dot }) => (
              <div key={label} className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '6px' }}>
                  <span className={`dot ${dot}`} />
                  <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '32px', color, lineHeight: 1, letterSpacing: '-0.03em' }}>{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tomorrow's crew ── */}
        <div className="animate-in stagger-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {lang === 'es' ? 'Equipo de Mañana' : "Tomorrow's Crew"}
            </p>
            {tomorrowConfs.length > 0 && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {confirmedCount > 0 && <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--green)' }}>{confirmedCount} {lang === 'es' ? 'confirmado' : 'confirmed'}</span>}
                {pendingCount > 0   && <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--amber)' }}>{pendingCount} {lang === 'es' ? 'pendiente' : 'pending'}</span>}
              </div>
            )}
          </div>

          {tomorrowConfs.length === 0 ? (
            <div className="card-flat" style={{ padding: '24px 16px', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {lang === 'es' ? 'No hay confirmaciones aún — ve a Housekeeping > Schedule para enviar.' : 'No confirmations yet — go to Housekeeping › Schedule to send.'}
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tomorrowConfs.map(conf => (
                  <div key={conf.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{conf.staffName}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: STATUS_COLOR[conf.status] }}>
                      {STATUS_ICON[conf.status]}
                      {t(conf.status === 'pending' ? 'statusPending' : conf.status === 'confirmed' ? 'statusConfirmed' : conf.status === 'declined' ? 'statusDeclined' : 'statusNoResponse', lang)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}

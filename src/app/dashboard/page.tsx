'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  subscribeToRooms,
  getDeepCleanConfig, getDeepCleanRecords,
  subscribeToWorkOrders,
} from '@/lib/firestore';
import { getOverdueRooms, calcDndFreedMinutes, suggestDeepCleans } from '@/lib/calculations';
import { todayStr } from '@/lib/utils';
import type { Room, DeepCleanConfig, DeepCleanRecord, WorkOrder } from '@/types';
import {
  Clock, AlertTriangle,
  DollarSign, Wrench,
  Zap, Percent,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeProperty, activePropertyId, loading: propLoading } = useProperty();
  const { lang } = useLang();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [dcConfig, setDcConfig] = useState<DeepCleanConfig | null>(null);
  const [dcRecords, setDcRecords] = useState<DeepCleanRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  const [arrivals, setArrivals] = useState(0);
  const [inHouseGuests, setInHouseGuests] = useState(0);
  const [reservationCount, setReservationCount] = useState(0);
  const [adr, setAdr] = useState(0);
  const [editingField, setEditingField] = useState<string | null>(null);


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
    Promise.all([
      getDeepCleanConfig(user.uid, activePropertyId),
      getDeepCleanRecords(user.uid, activePropertyId),
    ]).then(([config, records]) => {
      setDcConfig(config);
      setDcRecords(records);
    });
  }, [user, activePropertyId]);

  useEffect(() => {
    if (!user || !activePropertyId) return;
    return subscribeToWorkOrders(user.uid, activePropertyId, setWorkOrders);
  }, [user, activePropertyId]);

  const openOrders = workOrders.filter(o => o.status !== 'resolved');
  const urgentOrders = openOrders.filter(o => o.severity === 'urgent');
  const blockedRooms = openOrders.filter(o => o.blockedRoom).length;

  const clean      = rooms.filter(r => r.status === 'clean' || r.status === 'inspected').length;
  const inProgress = rooms.filter(r => r.status === 'in_progress').length;
  const dirty      = rooms.filter(r => r.status === 'dirty').length;
  const checkouts  = rooms.filter(r => r.type === 'checkout').length;
  const stayovers  = rooms.filter(r => r.type === 'stayover').length;
  const vacant     = rooms.filter(r => r.type === 'vacant').length;
  const total      = rooms.length;
  const pct        = total > 0 ? Math.round((clean / total) * 100) : 0;

  const totalPropertyRooms = activeProperty?.totalRooms || 0;
  const rentedRooms = checkouts + stayovers;
  const occupancyPct = totalPropertyRooms > 0 ? Math.round((rentedRooms / totalPropertyRooms) * 100) : 0;
  const revpar = totalPropertyRooms > 0 && adr > 0 ? Math.round((adr * rentedRooms) / totalPropertyRooms) : 0;


  const overdueRooms = dcConfig && dcRecords.length > 0
    ? getOverdueRooms(dcRecords.map(r => r.roomNumber), dcRecords, dcConfig)
    : [];
  const dndFreedMins = activeProperty
    ? calcDndFreedMinutes(rooms, activeProperty)
    : 0;
  const dcSuggestion = dcConfig && overdueRooms.length > 0
    ? suggestDeepCleans(dndFreedMins, 0, dcConfig, overdueRooms.length)
    : null;

  const avgTurnover = useMemo(() => {
    const toMs = (v: unknown): number | null => {
      if (!v) return null;
      if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate().getTime();
      const d = new Date(v as string | number | Date);
      return isNaN(d.getTime()) ? null : d.getTime();
    };
    const timed = rooms
      .filter(r => r.startedAt && r.completedAt)
      .map(r => {
        const s = toMs(r.startedAt);
        const e = toMs(r.completedAt);
        if (!s || !e) return 0;
        return (e - s) / 60000;
      })
      .filter(m => m > 0 && m < 480);
    return timed.length > 0 ? Math.round(timed.reduce((a, b) => a + b, 0) / timed.length) : null;
  }, [rooms]);

  if (authLoading || propLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  /* ── Inline editable number ── */
  const InlineEdit = ({ value, onChange, fieldKey, prefix }: {
    value: number; onChange: (v: number) => void; fieldKey: string; prefix?: string;
  }) => {
    const isEditing = editingField === fieldKey;
    if (isEditing) {
      return (
        <input
          type="number"
          autoFocus
          value={value || ''}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          onBlur={() => setEditingField(null)}
          onKeyDown={e => { if (e.key === 'Enter') setEditingField(null); }}
          style={{
            width: '64px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px',
            border: '2px solid var(--navy)', borderRadius: '6px', padding: '2px 6px',
            background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none',
          }}
        />
      );
    }
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setEditingField(fieldKey); }}
        style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', cursor: 'pointer', borderBottom: '1px dashed var(--border)' }}
      >
        {value > 0 ? `${prefix || ''}${value}` : '—'}
      </span>
    );
  };

  /* ── Labor cost calculation ── */
  const wage = activeProperty?.hourlyWage || 12;
  const hkStaff = rooms.length > 0 ? Math.ceil(rooms.length / 15) : 1;
  const hkCost = Math.round(hkStaff * wage * 8);
  const fdCost = Math.round(2 * wage * 8);
  const mtCost = Math.round(1 * wage * 8);
  const totalCost = fdCost + hkCost + mtCost;

  return (
    <AppLayout>
      <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>

        {/* ── Page header ── */}
        <div className="animate-in">
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {t('dashboard', lang)}
          </h1>
        </div>

        {/* ════════════════════════════════════════════════════════════
            HERO ROW — The 3 numbers that matter most at a glance
            ════════════════════════════════════════════════════════════ */}
        <div className="animate-in stagger-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>

          {/* Occupancy — the big one */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(27,58,92,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Percent size={15} color="var(--navy)" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>{t('occupancy', lang)}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '36px', lineHeight: 1, letterSpacing: '-0.04em', color: occupancyPct >= 80 ? '#16A34A' : occupancyPct >= 50 ? 'var(--navy)' : '#d97706' }}>
              {occupancyPct}<span style={{ fontSize: '22px', fontWeight: 600 }}>%</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {rentedRooms} of {totalPropertyRooms} rooms occupied
            </p>
          </div>

          {/* Dirty Rooms — action needed */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: dirty > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={15} color={dirty > 0 ? '#DC2626' : '#16A34A'} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>{t('dirtyRooms', lang)}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '36px', lineHeight: 1, letterSpacing: '-0.04em', color: dirty > 0 ? '#DC2626' : '#16A34A' }}>
              {dirty}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {clean} {t('clean', lang).toLowerCase()} · {inProgress} {t('progress', lang).toLowerCase()}
            </p>
          </div>

          {/* Est. Labor Cost */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(202,138,4,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={15} color="#CA8A04" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>{t('estLaborCost', lang)}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '36px', lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--navy)' }}>
              ${totalCost}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {lang === 'es' ? 'hoy' : 'today'} · {hkStaff + 3} {lang === 'es' ? 'personal' : 'staff'}
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            DEEP CLEAN ALERT — only shows when rooms are overdue
            ════════════════════════════════════════════════════════════ */}
        {overdueRooms.length > 0 && (
          <div
            className="animate-in stagger-1"
            style={{
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(220,38,38,0.04) 100%)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'rgba(245,158,11,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Zap size={16} color="#f59e0b" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>
                {overdueRooms.length} room{overdueRooms.length !== 1 ? 's' : ''} overdue for deep cleaning
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {dndFreedMins > 0 ? `${dndFreedMins} min freed from DND rooms.` : ''}
                {dcSuggestion && dcSuggestion.count > 0
                  ? ` Could fit ${dcSuggestion.count} deep clean${dcSuggestion.count !== 1 ? 's' : ''}.`
                  : ''}
              </p>
            </div>
          </div>
        )}


        {/* ════════════════════════════════════════════════════════════
            DETAILS — Secondary stats in a compact, single card
            ════════════════════════════════════════════════════════════ */}
        <div className="animate-in stagger-3 card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '14px' }}>

            {/* Guests section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0 }}>
                {lang === 'es' ? 'Huéspedes' : 'Guests'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('arrivals', lang)}</span>
                  <InlineEdit value={arrivals} onChange={setArrivals} fieldKey="arrivals" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('reservations', lang)}</span>
                  <InlineEdit value={reservationCount} onChange={setReservationCount} fieldKey="reservations" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('inHouse', lang)}</span>
                  <InlineEdit value={inHouseGuests} onChange={setInHouseGuests} fieldKey="inHouse" />
                </div>
              </div>
            </div>

            {/* Revenue section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0 }}>
                {lang === 'es' ? 'Ingresos' : 'Revenue'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('adr', lang)}</span>
                  <InlineEdit value={adr} onChange={setAdr} fieldKey="adr" prefix="$" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('revpar', lang)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                    {adr > 0 ? `$${revpar}` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Operations section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0 }}>
                {lang === 'es' ? 'Operaciones' : 'Operations'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('avgTurnover', lang)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                    {avgTurnover !== null ? `${avgTurnover}m` : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('openWorkOrders', lang)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', color: urgentOrders.length > 0 ? '#DC2626' : 'var(--text-primary)' }}>
                    {openOrders.length}
                    {urgentOrders.length > 0 && <span style={{ fontSize: '10px', color: '#DC2626', marginLeft: '4px' }}>!</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Rooms section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0 }}>
                {lang === 'es' ? 'Habitaciones' : 'Rooms'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('availableRooms', lang)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', color: 'var(--navy)' }}>{vacant}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('blockedRooms', lang)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', color: blockedRooms > 0 ? '#DC2626' : 'var(--text-primary)' }}>{blockedRooms}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('total', lang)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', color: 'var(--text-muted)' }}>{totalPropertyRooms}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </AppLayout>
  );
}

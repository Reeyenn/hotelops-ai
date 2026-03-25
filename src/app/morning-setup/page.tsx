'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { AppLayout } from '@/components/layout/AppLayout';
import { calcSchedule, formatCurrency, formatMinutes } from '@/lib/calculations';
import { saveDailyLog, subscribeToRooms } from '@/lib/firestore';
import { todayStr, getFloorLabel } from '@/lib/utils';
import type { MorningSetupForm, ScheduleResult, DailyLog, Room } from '@/types';
import { format } from 'date-fns';
import {
  Sun, Calculator, Save, ChevronDown, ChevronUp,
  BedDouble, MapPin, RefreshCw, DollarSign, Clock,
  CheckCircle, Info, Wifi,
} from 'lucide-react';

/* ── Number input ── */
const NumInput = ({
  label, field, min = 0, form, upd,
}: {
  label: string; field: string; min?: number; form: MorningSetupForm; upd: (k: keyof MorningSetupForm, v: number | string) => void;
}) => {
  const [raw, setRaw] = React.useState(String((form as unknown as Record<string, unknown>)[field]));
  React.useEffect(() => { setRaw(String((form as unknown as Record<string, unknown>)[field])); }, [(form as unknown as Record<string, unknown>)[field]]);

  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number" inputMode="numeric" min={min}
        value={raw}
        onFocus={() => { if (parseInt(raw) === 0) setRaw(''); }}
        onChange={e => {
          setRaw(e.target.value);
          const n = parseInt(e.target.value);
          if (!isNaN(n)) upd(field as keyof MorningSetupForm, Math.max(min, n));
        }}
        onBlur={() => {
          const n = parseInt(raw);
          const final = isNaN(n) ? min : Math.max(min, n);
          setRaw(String(final));
          upd(field as keyof MorningSetupForm, final);
        }}
        className="input-mono"
      />
    </div>
  );
};

/* ── Switch ── */
const SpecSwitch = ({
  checked, onChange, id,
}: { checked: boolean; onChange: (v: boolean) => void; id: string }) => (
  <label htmlFor={id} style={{ cursor: 'pointer' }}>
    <input
      className="sw__input"
      type="checkbox"
      role="switch"
      id={id}
      checked={checked}
      aria-checked={checked}
      onChange={e => onChange(e.target.checked)}
    />
    <span className="sw__track"><span className="sw__handle" /></span>
  </label>
);

/* ── Page ── */
export default function MorningSetupPage() {
  const { user }  = useAuth();
  const { activeProperty, activePropertyId, staff, publicAreas, laundryConfig } = useProperty();
  const { lang }  = useLang();

  const [form, setForm] = useState<MorningSetupForm>({
    occupied: 0, checkouts: 0, twoBedCheckouts: 0, stayovers: 0,
    vips: 0, earlyCheckins: 0, startTime: '09:00',
    scheduledStaff: activeProperty?.totalStaffOnRoster ?? 8,
    hourlyWage: activeProperty?.hourlyWage ?? 15,
  });

  const [result,            setResult]            = useState<ScheduleResult | null>(null);
  const [showAreas,         setShowAreas]         = useState(false);
  const [showLaundry,       setShowLaundry]       = useState(false);
  const [saved,             setSaved]             = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [meetingRoomRented, setMeetingRoomRented] = useState(false);
  const [scrapeLoading,     setScrapeLoading]     = useState(true);
  const [lastSynced,        setLastSynced]        = useState<Date | null>(null);
  const [hasLiveData,       setHasLiveData]       = useState(false);

  useEffect(() => {
    if (!activeProperty) return;
    setForm(f => ({
      ...f,
      scheduledStaff: activeProperty.totalStaffOnRoster,
      hourlyWage: f.hourlyWage ?? activeProperty.hourlyWage,
    }));
  }, [activeProperty]);

  // Live room counts from scraper
  useEffect(() => {
    if (!user || !activePropertyId) return;
    const unsub = subscribeToRooms(user.uid, activePropertyId, todayStr(), (rooms) => {
      setScrapeLoading(false);
      if (rooms.length === 0) return;
      const checkouts      = rooms.filter(r => r.type === 'checkout').length;
      const stayovers      = rooms.filter(r => r.type === 'stayover').length;
      const occupied       = checkouts + stayovers;
      const twoBedCheckouts = rooms.filter(r =>
        r.type === 'checkout' &&
        ((r as Room & { _caRoomType?: string })._caRoomType ?? '').includes('QQ')
      ).length;
      setForm(f => ({ ...f, occupied, checkouts, stayovers, twoBedCheckouts }));
      setHasLiveData(true);
      setLastSynced(new Date());
    });
    return unsub;
  }, [user, activePropertyId]);

  const upd = (k: keyof MorningSetupForm, v: number | string) => {
    setForm(f => ({ ...f, [k]: v }));
    setResult(null);
    setSaved(false);
  };

  const handleCalculate = () => {
    if (!activeProperty) return;
    const areasWithMeeting = publicAreas.map(a =>
      a.onlyWhenRented ? { ...a, isRentedToday: meetingRoomRented } : a
    );
    const r = calcSchedule(form, activeProperty, areasWithMeeting, laundryConfig, staff, new Date());
    setResult(r);
    setSaved(false);
    setTimeout(() => document.getElementById('result-anchor')?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  const handleSave = async () => {
    if (!result || !user || !activePropertyId || !activeProperty) return;
    setSaving(true);
    try {
      const log: DailyLog = {
        date: todayStr(),
        hotelId: activePropertyId,
        occupied: form.occupied, checkouts: form.checkouts,
        twoBedCheckouts: form.twoBedCheckouts, stayovers: form.stayovers,
        vips: form.vips, earlyCheckins: form.earlyCheckins,
        roomMinutes: result.roomMinutes, publicAreaMinutes: result.publicAreaMinutes,
        laundryMinutes: result.laundryMinutes, totalMinutes: result.totalMinutes,
        recommendedStaff: result.recommendedStaff, actualStaff: form.scheduledStaff,
        hourlyWage: form.hourlyWage ?? activeProperty.hourlyWage,
        laborCost: result.estimatedLaborCost, laborSaved: result.laborSaved,
        startTime: form.startTime, completionTime: result.estimatedCompletionTime,
        publicAreasDueToday: result.publicAreasDueToday.map(a => a.name),
        laundryLoads: {
          towels:     result.laundryBreakdown.find(b => b.category.toLowerCase().includes('towel'))?.loads ?? 0,
          sheets:     result.laundryBreakdown.find(b => b.category.toLowerCase().includes('sheet'))?.loads ?? 0,
          comforters: result.laundryBreakdown.find(b => b.category.toLowerCase().includes('comfort'))?.loads ?? 0,
        },
      };
      await saveDailyLog(user.uid, activePropertyId, log);
      setSaved(true);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ── Header ── */}
        <div className="animate-in" style={{ padding: '8px 0 4px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sun size={20} color="var(--amber)" strokeWidth={2} />
            <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '24px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {t('morningSetup', lang)}
            </h1>
          </div>
        </div>

        {/* ── Live room counts from scraper ── */}
        <div className="animate-in stagger-1">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <p className="section-title" style={{ margin: 0 }}>Today&apos;s Rooms</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {scrapeLoading ? (
                <div className="spinner" style={{ width: '10px', height: '10px' }} />
              ) : (
                <Wifi size={11} color={hasLiveData ? 'var(--green)' : 'var(--text-muted)'} />
              )}
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                {scrapeLoading ? 'Loading…' : hasLiveData && lastSynced
                  ? `Synced ${Math.round((Date.now() - lastSynced.getTime()) / 60000) || '<1'} min ago`
                  : 'No data yet'}
              </span>
            </div>
          </div>

          {scrapeLoading ? (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <div className="spinner" style={{ width: '14px', height: '14px' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading room data…</span>
            </div>
          ) : !hasLiveData ? (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '16px 14px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                No rooms synced today yet. Scraper runs every 15 min.
              </p>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
            }}>
              {[
                { label: 'Checkouts',      value: form.checkouts,      accent: true  },
                { label: 'Stayovers',      value: form.stayovers,      accent: false },
                { label: 'Occupied',       value: form.occupied,       accent: false },
                { label: '2-Bed Checkouts', value: form.twoBedCheckouts, accent: false },
              ].map(({ label, value, accent }, i, arr) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 14px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '18px',
                    color: accent ? 'var(--amber)' : 'var(--text-primary)',
                  }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Input form ── */}
        <div className="animate-in stagger-1">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <NumInput label={t('vipRooms', lang)}             field="vips"          form={form} upd={upd} />
            <NumInput label={t('earlyCheckinRequests', lang)} field="earlyCheckins" form={form} upd={upd} />
          </div>

          <p className="section-title" style={{ marginTop: '16px' }}>{t('scheduleSection', lang)}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label className="label">{t('startTime', lang)}</label>
              <input
                type="time" value={form.startTime}
                onChange={e => upd('startTime', e.target.value)}
                className="input-mono"
              />
            </div>
            <NumInput label={t('scheduledStaff', lang)} field="scheduledStaff" min={1} form={form} upd={upd} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <NumInput label={t('hourlyWageDollar', lang)} field="hourlyWage" min={1} form={form} upd={upd} />
          </div>

          {/* Meeting room toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '1px' }}>
                {t('meetingRoomRented', lang)}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('addsCleaningTime', lang)}</p>
            </div>
            <SpecSwitch id="meeting-room" checked={meetingRoomRented} onChange={setMeetingRoomRented} />
          </div>
        </div>

        {/* ── Breakfast staffing ── */}
        {form.occupied > 0 && (() => {
          const attendants = Math.max(1, Math.ceil(form.occupied / 45));
          const setupMins  = form.occupied > 30 ? 30 : 15;
          const startHr    = parseInt(form.startTime.split(':')[0]);
          const startMin   = parseInt(form.startTime.split(':')[1]);
          const bfMin      = startHr * 60 + startMin - setupMins;
          const bfH        = Math.floor(((bfMin % 1440) + 1440) % 1440 / 60);
          const bfM        = ((bfMin % 1440) + 1440) % 1440 % 60;
          const bfTime     = `${bfH % 12 || 12}:${String(bfM).padStart(2, '0')} ${bfH < 12 ? 'AM' : 'PM'}`;
          return (
            <div className="animate-in stagger-2" style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>🍳</span>
                <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{t('breakfastStaffing', lang)}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber-border)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '24px', color: 'var(--amber)', lineHeight: 1 }}>{attendants}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('attendantsLabel', lang)}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', lineHeight: 1 }}>{bfTime}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('setupStart', lang)}</div>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {lang === 'en' ? `Based on ${form.occupied} occupied rooms · ` : `Basado en ${form.occupied} habitaciones ocupadas · `}{t('basedOnOccupied', lang)}
              </p>
            </div>
          );
        })()}

        {/* ── Public areas collapsible ── */}
        <div className="animate-in stagger-2" style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowAreas(v => !v)}
            style={{
              width: '100%', padding: '12px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'transparent', border: 'none',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={14} color="var(--text-muted)" />
              <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>
                {t('publicAreasDueToday', lang)}
              </span>
              <span style={{
                background: 'var(--amber-dim)', color: 'var(--amber)',
                fontSize: '11px', fontWeight: 600, padding: '1px 7px',
                borderRadius: 'var(--radius-full)',
              }}>
                {publicAreas.filter(a => a.onlyWhenRented ? meetingRoomRented : true).length}
              </span>
            </div>
            {showAreas ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
          </button>

          {showAreas && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
              {(['1', '2', '3', '4', 'exterior'] as const).map(floor => {
                const floorAreas = publicAreas.filter(a => a.floor === floor);
                if (!floorAreas.length) return null;
                return (
                  <div key={floor} style={{ marginTop: '12px' }}>
                    <p className="label" style={{ marginBottom: '6px' }}>{getFloorLabel(floor, lang)}</p>
                    {floorAreas.map(area => {
                      const isDue = area.frequencyDays === 1 || !area.onlyWhenRented;
                      return (
                        <div key={area.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 0', borderBottom: '1px solid var(--border)',
                          opacity: isDue ? 1 : 0.4,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isDue && <span className="dot dot-green" />}
                            <span style={{ fontSize: '13px', color: isDue ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {area.name}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {area.locations} × {area.minutesPerClean}m
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Calculate button ── */}
        <button
          onClick={handleCalculate}
          disabled={!activeProperty}
          className="animate-in stagger-2"
          style={{
            width: '100%', height: '48px',
            background: 'var(--amber)', color: '#0A0A0A',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px',
            cursor: activeProperty ? 'pointer' : 'not-allowed',
            opacity: activeProperty ? 1 : 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 120ms',
          }}
        >
          <Calculator size={18} />
          {t('calculateSchedule', lang)}
        </button>

        {/* ── RESULT ── */}
        {result && (
          <div id="result-anchor" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Hero number */}
            <div style={{
              background: 'var(--amber-dim)',
              border: '1px solid var(--amber-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 24px 28px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '8px', opacity: 0.7 }}>
                {t('recommended', lang)}
              </p>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 'clamp(80px, 22vw, 120px)',
                color: 'var(--amber)',
                lineHeight: 0.9,
                letterSpacing: '-0.04em',
              }}>
                {result.recommendedStaff}
              </div>
              <p style={{
                fontFamily: 'var(--font-sans)', fontWeight: 600,
                fontSize: '14px', color: 'var(--text-secondary)',
                marginTop: '12px', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {t('houseekeepersNeededToday', lang)}
              </p>
              {result.laborSaved > 0 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  marginTop: '12px',
                  background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 'var(--radius-full)', padding: '4px 12px',
                }}>
                  <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>
                    {t('savingToday', lang)} {formatCurrency(result.laborSaved)} {lang === 'es' ? 'hoy' : 'today'}
                  </span>
                </div>
              )}
            </div>

            {/* Workload breakdown */}
            <div className="card">
              <p className="section-title">{t('workloadBreakdown', lang)}</p>
              {[
                { label: t('roomMinutes', lang),       value: result.roomMinutes,       icon: BedDouble },
                { label: t('publicAreaMinutes', lang), value: result.publicAreaMinutes, icon: MapPin    },
                { label: t('laundryMinutes', lang),    value: result.laundryMinutes,    icon: RefreshCw },
              ].map(({ label, value, icon: Icon }, i, arr) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatMinutes(value)}
                  </span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: '10px', marginTop: '2px', borderTop: '1px solid var(--border-bright)',
              }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {t('totalMinutes', lang)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', color: 'var(--amber)' }}>
                  {formatMinutes(result.totalMinutes)}
                </span>
              </div>
            </div>

            {/* Key metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { icon: Clock,      label: t('estimatedFinish', lang), value: result.estimatedCompletionTime },
                { icon: DollarSign, label: t('laborCost', lang),       value: formatCurrency(result.estimatedLaborCost) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                  <Icon size={14} color="var(--text-muted)" style={{ marginBottom: '6px' }} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {value}
                  </div>
                  <div className="stat-label" style={{ marginTop: '4px' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Labor saved callout */}
            {result.laborSaved > 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '20px', borderColor: 'rgba(34,197,94,0.2)', background: 'var(--green-dim)' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(34,197,94,0.6)', marginBottom: '6px' }}>
                  {t('laborSaved', lang)}
                </p>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                  fontSize: 'clamp(36px, 12vw, 56px)',
                  color: 'var(--green)', lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}>
                  {formatCurrency(result.laborSaved)}
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(34,197,94,0.55)', marginTop: '6px' }}>
                  {t('vsFullTeam', lang)}
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="card-flat" style={{ display: 'flex', gap: '10px', padding: '14px' }}>
              <Info size={13} color="var(--text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {lang === 'en' ? 'Based on' : 'Basado en'}{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{form.checkouts} {lang === 'en' ? 'checkouts' : 'salidas'}</strong>,{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{form.stayovers} {lang === 'en' ? 'stayovers' : 'continuaciones'}</strong>,{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{result.publicAreasDueToday.length} {lang === 'en' ? 'public areas' : 'áreas comunes'}</strong>,
                {lang === 'en' ? ' and' : ' y'}{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{result.laundryBreakdown.reduce((s, b) => s + b.loads, 0)} {lang === 'en' ? 'laundry loads' : 'cargas de lavandería'}</strong>
                {lang === 'en'
                  ? <>{' '}— you need <strong style={{ color: 'var(--amber)' }}>{result.recommendedStaff} housekeepers</strong> starting at{' '}<strong style={{ color: 'var(--amber)' }}>{form.startTime}</strong>.</>
                  : <>{' '}— necesitas <strong style={{ color: 'var(--amber)' }}>{result.recommendedStaff} camareras</strong> empezando a las{' '}<strong style={{ color: 'var(--amber)' }}>{form.startTime}</strong>.</>
                }
                {result.laborSaved > 0 && (
                  lang === 'en'
                    ? <> Saving <strong style={{ color: 'var(--green)' }}>{formatCurrency(result.laborSaved)}</strong> vs. full team.</>
                    : <> Ahorrando <strong style={{ color: 'var(--green)' }}>{formatCurrency(result.laborSaved)}</strong> vs. equipo completo.</>
                )}
              </p>
            </div>

            {/* Laundry detail */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
            }}>
              <button
                onClick={() => setShowLaundry(v => !v)}
                style={{
                  width: '100%', padding: '12px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={13} color="var(--text-muted)" />
                  <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>{t('laundryBreakdownLabel', lang)}</span>
                </div>
                {showLaundry ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
              </button>
              {showLaundry && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                  {result.laundryBreakdown.map(b => (
                    <div key={b.category} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '8px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{b.category}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
                        {b.loads} loads × 60m = {formatMinutes(b.minutes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || saved}
              style={{
                width: '100%', height: '48px',
                background: saved ? 'var(--green-dim)' : 'var(--amber)',
                color: saved ? 'var(--green)' : '#0A0A0A',
                border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px',
                cursor: saving || saved ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                marginBottom: '16px',
                transition: 'all 120ms',
              }}
            >
              {saved ? (
                <><CheckCircle size={18} /> {t('savedToLog', lang)}</>
              ) : saving ? (
                <><div className="spinner" style={{ width: '18px', height: '18px' }} /> {t('savingInProgress', lang)}</>
              ) : (
                <><Save size={18} /> {t('saveToLog', lang)}</>
              )}
            </button>

          </div>
        )}

      </div>
    </AppLayout>
  );
}

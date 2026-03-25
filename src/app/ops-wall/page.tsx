'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { subscribeToRooms, subscribeToGuestRequests } from '@/lib/firestore';
import { todayStr } from '@/lib/utils';
import type { Room, GuestRequest } from '@/types';
import { format } from 'date-fns';
import { BedDouble, Bell, Maximize2, Minimize2 } from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  dirty:       { bg: 'rgba(239,68,68,0.14)',   border: 'rgba(239,68,68,0.38)',   color: '#EF4444' },
  in_progress: { bg: 'rgba(251,191,36,0.14)',  border: 'rgba(251,191,36,0.38)',  color: '#FBBF24' },
  clean:       { bg: 'rgba(34,197,94,0.14)',   border: 'rgba(34,197,94,0.38)',   color: '#22C55E' },
  inspected:   { bg: 'rgba(139,92,246,0.14)',  border: 'rgba(139,92,246,0.38)',  color: '#8B5CF6' },
};

const STATUS_KEY_MAP: Record<string, 'dirty' | 'inProgress' | 'clean' | 'inspected'> = {
  dirty: 'dirty', in_progress: 'inProgress', clean: 'clean', inspected: 'inspected',
};

const STATUS_ORDER: Record<string, number> = { dirty: 0, in_progress: 1, clean: 2, inspected: 3 };

const REQ_EMOJI: Record<string, string> = {
  towels: '🛁', pillows: '🛏️', blanket: '🛌', iron: '👔',
  crib: '🍼', toothbrush: '🪥', amenities: '🧴', maintenance: '🔧', other: '📋',
};

// ── Live clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{format(now, 'h:mm:ss a')}</span>;
}

// ── Time-ago helper ────────────────────────────────────────────────────────────
function timeAgo(date: Date | null): string {
  if (!date) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OpsWallPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeProperty, activePropertyId, loading: propLoading } = useProperty();
  const router = useRouter();
  const { lang } = useLang();

  const [rooms,    setRooms]    = useState<Room[]>([]);
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !propLoading && !user) router.replace('/signin');
    if (!authLoading && !propLoading && user && !activePropertyId) router.replace('/onboarding');
  }, [user, authLoading, propLoading, activePropertyId, router]);

  // Subscriptions
  useEffect(() => {
    if (!user || !activePropertyId) return;
    return subscribeToRooms(user.uid, activePropertyId, todayStr(), setRooms);
  }, [user, activePropertyId]);

  useEffect(() => {
    if (!user || !activePropertyId) return;
    return subscribeToGuestRequests(user.uid, activePropertyId, setRequests);
  }, [user, activePropertyId]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Derived stats
  const dirty      = rooms.filter(r => r.status === 'dirty').length;
  const inProgress = rooms.filter(r => r.status === 'in_progress').length;
  const clean      = rooms.filter(r => r.status === 'clean').length;
  const inspected  = rooms.filter(r => r.status === 'inspected').length;
  const total      = rooms.length;
  const done       = clean + inspected;
  const pct        = total > 0 ? Math.round((done / total) * 100) : 0;

  const activeReqs    = requests.filter(r => r.status !== 'done');
  const pendingReqs   = requests.filter(r => r.status === 'pending');
  const doneToday     = requests.filter(r => r.status === 'done').length;
  const showSidebar   = activeReqs.length > 0 || doneToday > 0;

  // Sort rooms: dirty → in_progress → clean → inspected
  const sorted = [...rooms].sort((a, b) =>
    (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4)
  );

  if (authLoading || propLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
        {t('loading', lang)}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      maxHeight: '100dvh',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: '12px',
      }}>

        {/* Left: branding + property */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BedDouble size={15} color="var(--amber)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeProperty?.name ?? 'HotelOps AI'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t('liveOpsWall', lang)}
            </div>
          </div>
        </div>

        {/* Center: status pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {([
            { statusKey: 'dirty'      as const, value: dirty,      color: '#EF4444', dim: 'rgba(239,68,68,0.12)'   },
            { statusKey: 'inProgress' as const, value: inProgress, color: '#FBBF24', dim: 'rgba(251,191,36,0.12)'  },
            { statusKey: 'clean'      as const, value: clean,      color: '#22C55E', dim: 'rgba(34,197,94,0.12)'   },
            { statusKey: 'inspected'  as const, value: inspected,  color: '#8B5CF6', dim: 'rgba(139,92,246,0.12)'  },
          ]).map(({ statusKey, value, color, dim }) => (
            <div key={statusKey} style={{
              padding: '5px 10px', borderRadius: 6,
              background: value > 0 ? dim : 'var(--bg-card)',
              border: `1px solid ${value > 0 ? color + '44' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: value > 0 ? color : 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
                {t(statusKey, lang).toUpperCase()}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: value > 0 ? color : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
            </div>
          ))}

          {/* Active requests alert pill */}
          {pendingReqs.length > 0 && (
            <div style={{
              padding: '5px 10px', borderRadius: 6,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', gap: '6px',
              animation: 'pulse 2s infinite',
            }}>
              <Bell size={11} color="#EF4444" />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
                {t('requests', lang).toUpperCase()}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#EF4444', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{pendingReqs.length}</span>
            </div>
          )}
        </div>

        {/* Right: clock + completion + controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Completion */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '4px 12px', borderRadius: 8,
            background: pct === 100 ? 'rgba(34,197,94,0.1)' : 'var(--bg-card)',
            border: `1px solid ${pct === 100 ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: pct === 100 ? '#22C55E' : 'var(--amber)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {pct}%
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
              {done}/{total} {t('done', lang).toUpperCase()}
            </span>
          </div>

          {/* Clock */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              <LiveClock />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              {format(new Date(), 'EEE, MMM d')}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={toggleFullscreen} style={{
              width: 30, height: 30, borderRadius: 6,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}>
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <Link href="/dashboard" style={{
              width: 30, height: 30, borderRadius: 6,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', color: 'var(--text-muted)', fontSize: 14,
            }}>
              ←
            </Link>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: showSidebar ? '1fr 260px' : '1fr',
        overflow: 'hidden',
        minHeight: 0,
      }}>

        {/* Room grid */}
        <div style={{
          padding: '14px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gridAutoRows: 'min-content',
          gap: '8px',
          alignContent: 'start',
        }}>
          {sorted.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1', textAlign: 'center', paddingTop: '80px',
              color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6,
            }}>
              {t('noRoomsForToday', lang)}
              <br />
              <span style={{ fontSize: 12 }}>
                {lang === 'es'
                  ? <>Agrega habitaciones desde la <Link href="/rooms" style={{ color: 'var(--amber)' }}>página de Habitaciones</Link>.</>
                  : <>Add rooms from the <Link href="/rooms" style={{ color: 'var(--amber)' }}>Rooms page</Link>.</>}
              </span>
            </div>
          ) : sorted.map(room => {
            const s = STATUS_STYLES[room.status] ?? STATUS_STYLES.dirty;
            const statusLabel = t(STATUS_KEY_MAP[room.status] ?? 'dirty', lang).toUpperCase();
            return (
              <div key={room.id} style={{
                background: s.bg,
                border: `1.5px solid ${room.isDnd ? 'rgba(249,115,22,0.5)' : s.border}`,
                borderRadius: 10,
                padding: '10px 8px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                position: 'relative',
                minHeight: 90,
                justifyContent: 'center',
              }}>
                {/* DND badge */}
                {room.isDnd && (
                  <div style={{
                    position: 'absolute', top: 4, right: 4,
                    fontSize: 7, fontWeight: 800, letterSpacing: '0.05em',
                    color: '#F97316', background: 'rgba(249,115,22,0.15)',
                    border: '1px solid rgba(249,115,22,0.3)',
                    borderRadius: 3, padding: '1px 4px',
                  }}>{t('dnd', lang)}</div>
                )}

                {/* VIP badge */}
                {room.priority === 'vip' && (
                  <div style={{
                    position: 'absolute', top: 4, left: 4,
                    fontSize: 8, color: '#F59E0B',
                  }}>⭐</div>
                )}

                {/* Room number */}
                <div style={{
                  fontSize: 26, fontWeight: 900, color: s.color,
                  fontFamily: 'var(--font-mono)', lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}>
                  {room.number}
                </div>

                {/* Status */}
                <div style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                  color: s.color, textTransform: 'uppercase',
                }}>
                  {statusLabel}
                </div>

                {/* Type */}
                <div style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                }}>
                  {room.type === 'checkout' ? 'CO' : room.type === 'stayover' ? 'SO' : 'VAC'}
                </div>

                {/* HK name */}
                {room.assignedName && (
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
                    textAlign: 'center', maxWidth: '100%',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingTop: 2,
                  }}>
                    {room.assignedName}
                  </div>
                )}

                {/* Timer if in progress */}
                {room.status === 'in_progress' && room.startedAt && (
                  <div style={{ fontSize: 9, color: '#FBBF24', fontFamily: 'var(--font-mono)' }}>
                    {timeAgo(room.startedAt instanceof Date ? room.startedAt : (room.startedAt as unknown as { toDate(): Date }).toDate())}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Sidebar: requests ──────────────────────────────────────────── */}
        {showSidebar && (
          <div style={{
            borderLeft: '1px solid var(--border)',
            padding: '14px 12px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minHeight: 0,
          }}>

            {/* Active requests */}
            {activeReqs.length > 0 && (
              <>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
                  color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2,
                }}>
                  {t('activeRequests', lang)}
                </div>
                {activeReqs.map(req => (
                  <div key={req.id} style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${req.status === 'pending' ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.25)'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                        {req.roomNumber}
                      </span>
                      <span style={{
                        fontSize: 8, fontWeight: 800, letterSpacing: '0.08em',
                        color: req.status === 'pending' ? '#EF4444' : '#FBBF24',
                        background: req.status === 'pending' ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
                        border: `1px solid ${req.status === 'pending' ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.25)'}`,
                        borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase',
                      }}>
                        {req.status === 'pending'
                          ? t('pending', lang).toUpperCase()
                          : t('active', lang).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{REQ_EMOJI[req.type] ?? '📋'}</span>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{req.type}</span>
                    </div>
                    {req.assignedName && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {req.assignedName}</div>
                    )}
                    {req.notes && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                        &ldquo;{req.notes}&rdquo;
                      </div>
                    )}
                    {req.createdAt && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                        {timeAgo(req.createdAt instanceof Date ? req.createdAt : (req.createdAt as unknown as { toDate(): Date }).toDate())}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Done today count */}
            {doneToday > 0 && (
              <div style={{
                marginTop: 4, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(34,197,94,0.07)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>
                  ✓ {doneToday} {t('requestsCompleted', lang)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom progress bar ─────────────────────────────────────────────── */}
      <div style={{ height: 4, background: 'var(--border)', flexShrink: 0 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct === 100 ? '#22C55E' : 'var(--amber)',
          transition: 'width 0.8s ease',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>
    </div>
  );
}

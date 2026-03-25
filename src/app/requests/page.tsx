'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Modal } from '@/components/ui/Modal';
import {
  subscribeToGuestRequests,
  addGuestRequest,
  updateGuestRequest,
  deleteGuestRequest,
} from '@/lib/firestore';
import type { GuestRequest, GuestRequestStatus, GuestRequestType } from '@/types';
import {
  Bell,
  Plus,
  ChevronDown,
  Trash2,
  Loader2,
  Check,
  Clock,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import type { Language } from '@/lib/translations';

// ─── Request type config with emoji icons ──────────────────────────────────

function getRequestTypeConfig(lang: Language): Record<GuestRequestType, { label: string; emoji: string }> {
  const isEs = lang === 'es';
  return {
    towels:      { label: isEs ? 'Toallas'       : 'Towels',      emoji: '🛁' },
    pillows:     { label: isEs ? 'Almohadas'     : 'Pillows',     emoji: '🛏' },
    blanket:     { label: isEs ? 'Cobija'        : 'Blanket',     emoji: '🧣' },
    iron:        { label: isEs ? 'Plancha'       : 'Iron',        emoji: '👔' },
    crib:        { label: isEs ? 'Cuna'          : 'Crib',        emoji: '🍼' },
    toothbrush:  { label: isEs ? 'Cepillo'       : 'Toothbrush',  emoji: '🪥' },
    amenities:   { label: isEs ? 'Amenidades'    : 'Amenities',   emoji: '🧴' },
    maintenance: { label: isEs ? 'Mantenimiento' : 'Maintenance', emoji: '🔧' },
    other:       { label: isEs ? 'Otro'          : 'Other',       emoji: '📋' },
  };
}

// ─── Status badge colors ────────────────────────────────────────────────────

const STATUS_COLOR: Record<GuestRequestStatus, { bg: string; text: string; border: string }> = {
  pending:     { bg: 'rgba(239,68,68,0.08)',  text: 'var(--red)',   border: 'var(--red-border)'   },
  in_progress: { bg: 'rgba(251,191,36,0.08)', text: 'var(--amber)', border: 'var(--amber-border)' },
  done:        { bg: 'rgba(34,197,94,0.08)',  text: 'var(--green)', border: 'var(--green-border)' },
};

// ─── Helper: Format time ago ────────────────────────────────────────────────

function timeAgo(date: Date | null | undefined): string {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '—';
  }
}

// ─── Helper: Convert Firestore Timestamp to Date ──────────────────────────

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as any).toDate === 'function') return (v as any).toDate();
  return new Date(v as string);
}

// ─── Main component ────────────────────────────────────────────────────────

export default function GuestRequestsPage() {
  const { user } = useAuth();
  const { activePropertyId, staff } = useProperty();
  const { lang } = useLang();

  const REQUEST_TYPE_CONFIG = getRequestTypeConfig(lang);

  // State
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'done'>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignDropdown, setAssignDropdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // New request form
  const [newForm, setNewForm] = useState({
    roomNumber: '',
    type: 'towels' as GuestRequestType,
    notes: '',
    assignedTo: '',
    assignedName: '',
  });

  // ── Subscription ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !activePropertyId) return;
    return subscribeToGuestRequests(user.uid, activePropertyId, (reqs) => {
      // Convert Firestore timestamps to Date objects
      const converted = reqs.map((r) => ({
        ...r,
        createdAt: toDate(r.createdAt),
        completedAt: r.completedAt ? toDate(r.completedAt) : undefined,
      }));
      setRequests(converted);
    });
  }, [user, activePropertyId]);

  // ── Filtered requests ────────────────────────────────────────────────────

  const filteredRequests = requests.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  // Sort by status (pending > in_progress > done)
  const statusOrder = { pending: 0, in_progress: 1, done: 2 };
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const aOrder = statusOrder[a.status];
    const bOrder = statusOrder[b.status];
    if (aOrder !== bOrder) return aOrder - bOrder;
    // Within same status, sort by createdAt descending
    return (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0);
  });

  // ── Counts ───────────────────────────────────────────────────────────────

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const inProgressCount = requests.filter((r) => r.status === 'in_progress').length;
  const doneToday = requests.filter((r) => {
    if (r.status !== 'done' || !r.completedAt) return false;
    const completed = toDate(r.completedAt);
    if (!completed) return false;
    const today = new Date();
    return (
      completed.getFullYear() === today.getFullYear() &&
      completed.getMonth() === today.getMonth() &&
      completed.getDate() === today.getDate()
    );
  }).length;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAddRequest = async () => {
    if (!user || !activePropertyId || !newForm.roomNumber.trim()) {
      setToast(lang === 'es' ? 'Número de habitación requerido' : 'Room number required');
      return;
    }

    try {
      setLoading(true);
      const cleanForm = Object.fromEntries(
        Object.entries(newForm).filter(([, v]) => v !== '' && v !== undefined)
      );
      await addGuestRequest(user.uid, activePropertyId, {
        propertyId: activePropertyId,
        roomNumber: newForm.roomNumber.trim(),
        type: newForm.type,
        notes: newForm.notes || undefined,
        status: 'pending',
        assignedTo: newForm.assignedTo || undefined,
        assignedName: newForm.assignedName || undefined,
      });
      setShowNewModal(false);
      setNewForm({ roomNumber: '', type: 'towels', notes: '', assignedTo: '', assignedName: '' });
      setToast(lang === 'es' ? 'Solicitud creada' : 'Request created');
    } catch (err) {
      setToast(lang === 'es' ? 'Error al crear solicitud' : 'Error creating request');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (req: GuestRequest, newStatus: GuestRequestStatus) => {
    if (!user || !activePropertyId) return;

    try {
      const update: Partial<GuestRequest> = { status: newStatus };
      if (newStatus === 'done') {
        update.completedAt = new Date();
      }
      await updateGuestRequest(user.uid, activePropertyId, req.id, update);
      setToast(`Marked as ${newStatus}`);
    } catch (err) {
      setToast(lang === 'es' ? 'Error al actualizar' : 'Error updating request');
      console.error(err);
    }
  };

  const handleAssign = async (req: GuestRequest, staffId: string) => {
    if (!user || !activePropertyId) return;

    try {
      const staffMember = staff.find((s) => s.id === staffId);
      await updateGuestRequest(user.uid, activePropertyId, req.id, {
        assignedTo: staffId,
        assignedName: staffMember?.name || '',
      });
      setAssignDropdown(null);
      setToast(`Assigned to ${staffMember?.name || 'staff'}`);
    } catch (err) {
      setToast(lang === 'es' ? 'Error al asignar' : 'Error assigning request');
      console.error(err);
    }
  };

  const handleDelete = async (req: GuestRequest) => {
    if (!user || !activePropertyId) return;

    try {
      await deleteGuestRequest(user.uid, activePropertyId, req.id);
      setToast(lang === 'es' ? 'Solicitud eliminada' : 'Request deleted');
    } catch (err) {
      setToast(lang === 'es' ? 'Error al eliminar' : 'Error deleting request');
      console.error(err);
    }
  };

  // ── Filter label helper ─────────────────────────────────────────────────

  const filterLabel = (f: 'all' | 'pending' | 'in_progress' | 'done') => {
    if (f === 'all') return t('all', lang);
    if (f === 'pending') return t('pending', lang);
    if (f === 'in_progress') return t('inProgress', lang);
    return t('done', lang);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Bell size={28} color="var(--amber)" />
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {t('guestRequests', lang)}
            </h1>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'var(--amber)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 200ms',
            }}
            onMouseEnter={(e) => ((e.currentTarget as any).style.opacity = '0.9')}
            onMouseLeave={(e) => ((e.currentTarget as any).style.opacity = '1')}
          >
            <Plus size={18} />
            {t('new', lang)}
          </button>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--red-dim)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--red)' }}>
              {pendingCount}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {t('pending', lang)}
            </div>
          </div>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--amber-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--amber)' }}>
              {inProgressCount}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {t('inProgress', lang)}
            </div>
          </div>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--green-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--green)' }}>
              {doneToday}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {t('doneToday', lang)}
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                background: filter === f ? 'var(--amber)' : 'transparent',
                color: filter === f ? '#000' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 200ms',
              }}
            >
              {filterLabel(f)}
            </button>
          ))}
        </div>

        {/* Request cards */}
        {sortedRequests.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-muted)',
            }}
          >
            <p style={{ fontSize: '14px', margin: 0 }}>
              {lang === 'es'
                ? 'Sin solicitudes'
                : filter === 'all'
                  ? 'No requests yet'
                  : `No ${filter.replace('_', ' ')} requests`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sortedRequests.map((req) => {
              const isExpanded = expandedId === req.id;
              const typeConfig = REQUEST_TYPE_CONFIG[req.type];
              const statusConfig = STATUS_COLOR[req.status];
              const created = toDate(req.createdAt);

              return (
                <div
                  key={req.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    transition: 'border-color 200ms',
                  }}
                >
                  {/* Header row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      {/* Room number (large, mono, amber) */}
                      <div
                        style={{
                          fontSize: '20px',
                          fontWeight: 700,
                          color: 'var(--amber)',
                          fontFamily: 'var(--font-mono)',
                          marginBottom: '6px',
                        }}
                      >
                        {lang === 'es' ? 'Hab.' : 'Room'} {req.roomNumber}
                      </div>

                      {/* Type + time */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>{typeConfig.emoji}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {typeConfig.label}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            marginLeft: '8px',
                          }}
                        >
                          {timeAgo(created)}
                        </span>
                      </div>

                      {/* Status badge */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: statusConfig.bg,
                          border: `1px solid ${statusConfig.border}`,
                          fontSize: '12px',
                          fontWeight: 600,
                          color: statusConfig.text,
                        }}
                      >
                        {req.status === 'in_progress' && <Loader2 size={12} className="animate-spin" />}
                        {req.status === 'done' && <Check size={12} />}
                        {req.status === 'pending' && <Clock size={12} />}
                        {req.status === 'pending' && t('pending', lang)}
                        {req.status === 'in_progress' && t('inProgress', lang)}
                        {req.status === 'done' && t('done', lang)}
                      </div>
                    </div>

                    {/* Assigned / Delete button */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '8px',
                      }}
                    >
                      {req.status === 'done' && (
                        <button
                          onClick={() => handleDelete(req)}
                          style={{
                            padding: '4px 8px',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            transition: 'all 200ms',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as any).style.borderColor = 'var(--red)';
                            (e.currentTarget as any).style.color = 'var(--red)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as any).style.borderColor = 'var(--border)';
                            (e.currentTarget as any).style.color = 'var(--text-secondary)';
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>
                        {req.assignedName ? (
                          req.assignedName
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{t('unassigned', lang)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes (if present, truncated) */}
                  {req.notes && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        marginTop: '8px',
                        lineHeight: '1.4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {req.notes}
                    </div>
                  )}

                  {/* Actions row */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(req, 'in_progress')}
                          style={{
                            flex: 1,
                            minWidth: '60px',
                            padding: '6px 10px',
                            background: 'var(--amber)',
                            color: '#000',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 200ms',
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as any).style.opacity = '0.9')}
                          onMouseLeave={(e) => ((e.currentTarget as any).style.opacity = '1')}
                        >
                          {t('start', lang)}
                        </button>
                        <button
                          onClick={() => handleStatusChange(req, 'done')}
                          style={{
                            flex: 1,
                            minWidth: '60px',
                            padding: '6px 10px',
                            background: 'var(--green)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 200ms',
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as any).style.opacity = '0.9')}
                          onMouseLeave={(e) => ((e.currentTarget as any).style.opacity = '1')}
                        >
                          {t('done', lang)}
                        </button>
                      </>
                    )}

                    {req.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusChange(req, 'done')}
                        style={{
                          flex: 1,
                          minWidth: '60px',
                          padding: '6px 10px',
                          background: 'var(--green)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'opacity 200ms',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as any).style.opacity = '0.9')}
                        onMouseLeave={(e) => ((e.currentTarget as any).style.opacity = '1')}
                      >
                        {t('done', lang)}
                      </button>
                    )}

                    {req.status === 'done' && req.completedAt && (
                      <div
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          textAlign: 'center',
                        }}
                      >
                        {format(toDate(req.completedAt) || new Date(), 'HH:mm')}
                      </div>
                    )}

                    {/* Assign button with dropdown */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() =>
                          setAssignDropdown(assignDropdown === req.id ? null : req.id)
                        }
                        style={{
                          padding: '6px 10px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 200ms',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as any).style.borderColor = 'var(--border-bright)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as any).style.borderColor = 'var(--border)';
                        }}
                      >
                        {t('assign', lang)}
                        <ChevronDown size={12} />
                      </button>

                      {/* Dropdown */}
                      {assignDropdown === req.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '4px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            minWidth: '150px',
                            zIndex: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          }}
                        >
                          {staff.length === 0 ? (
                            <div
                              style={{
                                padding: '8px 12px',
                                fontSize: '12px',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {t('noStaff', lang)}
                            </div>
                          ) : (
                            staff.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => handleAssign(req, s.id)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '8px 12px',
                                  textAlign: 'left',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  transition: 'background-color 150ms',
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as any).style.backgroundColor =
                                    'var(--border)';
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as any).style.backgroundColor =
                                    'transparent';
                                }}
                              >
                                {s.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Request Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setNewForm({ roomNumber: '', type: 'towels', notes: '', assignedTo: '', assignedName: '' });
        }}
      >
        <div style={{ maxWidth: '400px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
            {t('newGuestRequest', lang)}
          </h2>

          {/* Room number input */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}
            >
              {t('roomNumber', lang)}
            </label>
            <input
              type="text"
              value={newForm.roomNumber}
              onChange={(e) =>
                setNewForm({ ...newForm, roomNumber: e.target.value })
              }
              placeholder="e.g., 304"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Request type grid */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}
            >
              {t('requestType', lang)}
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
              }}
            >
              {(Object.keys(REQUEST_TYPE_CONFIG) as GuestRequestType[]).map((type) => {
                const cfg = REQUEST_TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => setNewForm({ ...newForm, type })}
                    style={{
                      padding: '10px',
                      background:
                        newForm.type === type
                          ? 'var(--amber)'
                          : 'var(--bg)',
                      border:
                        newForm.type === type
                          ? '1px solid var(--amber)'
                          : '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: newForm.type === type ? '#000' : 'var(--text-primary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{cfg.emoji}</span>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes textarea */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}
            >
              {t('notesOptional', lang)}
            </label>
            <textarea
              value={newForm.notes}
              onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
              placeholder={lang === 'es' ? 'Detalles adicionales...' : 'Any additional details...'}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: 'var(--font-sans)',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Assign dropdown */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}
            >
              {lang === 'es' ? 'Asignar A (opcional)' : 'Assign To (optional)'}
            </label>
            <select
              value={newForm.assignedTo}
              onChange={(e) => {
                const staffId = e.target.value;
                const staffMember = staff.find((s) => s.id === staffId);
                setNewForm({
                  ...newForm,
                  assignedTo: staffId,
                  assignedName: staffMember?.name || '',
                });
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            >
              <option value="">{t('selectStaff', lang)}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Toast message */}
          {toast && (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid var(--green-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--green)',
                marginBottom: '16px',
              }}
            >
              {toast}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setShowNewModal(false);
                setNewForm({
                  roomNumber: '',
                  type: 'towels',
                  notes: '',
                  assignedTo: '',
                  assignedName: '',
                });
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as any).style.borderColor = 'var(--border-bright)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as any).style.borderColor = 'var(--border)';
              }}
            >
              {t('cancel', lang)}
            </button>
            <button
              onClick={handleAddRequest}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: loading ? 'rgba(251,191,36,0.5)' : 'var(--amber)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#000',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'opacity 150ms',
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as any).style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as any).style.opacity = '1';
              }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading
                ? (lang === 'es' ? 'Creando...' : 'Creating...')
                : t('create', lang)}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast notification */}
      {toast && !showNewModal && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            color: 'var(--text-primary)',
            zIndex: 100,
            animation: 'fadeInUp 200ms ease-out',
          }}
        >
          {toast}
        </div>
      )}
    </AppLayout>
  );
}

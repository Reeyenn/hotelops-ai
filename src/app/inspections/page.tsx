'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Modal } from '@/components/ui/Modal';
import {
  subscribeToInspections, addInspection, updateInspection, deleteInspection,
} from '@/lib/firestore';
import type { Inspection } from '@/types';
import {
  Plus, ClipboardCheck, AlertTriangle, Check, Calendar, Trash2, ChevronRight,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_INSPECTIONS: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Elevator Inspection', propertyId: '', dueMonth: '', frequencyMonths: 12 },
  { name: 'Fire Extinguisher Inspection', propertyId: '', dueMonth: '', frequencyMonths: 12 },
  { name: 'Fire Sprinkler Inspection', propertyId: '', dueMonth: '', frequencyMonths: 12 },
  { name: 'Fire Panel Inspection', propertyId: '', dueMonth: '', frequencyMonths: 12 },
  { name: 'Breakfast / Health Inspection', propertyId: '', dueMonth: '', frequencyMonths: 6 },
  { name: 'Pool Inspection', propertyId: '', dueMonth: '', frequencyMonths: 12 },
  { name: 'Backflow Preventer Test', propertyId: '', dueMonth: '', frequencyMonths: 12 },
  { name: 'Pest Control Inspection', propertyId: '', dueMonth: '', frequencyMonths: 3 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(ym: string): string {
  if (!ym) return 'Not set';
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function addMonths(ym: string, months: number): string {
  const [y, m] = ym.split('-').map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

type InspectionStatus = 'overdue' | 'due' | 'upcoming' | 'notset';

function getStatus(dueMonth: string): InspectionStatus {
  if (!dueMonth) return 'notset';
  const now = currentYM();
  if (dueMonth < now) return 'overdue';
  if (dueMonth === now) return 'due';
  return 'upcoming';
}

const STATUS_CONFIG = {
  overdue: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)', label: 'Overdue', icon: AlertTriangle },
  due:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Due This Month', icon: Calendar },
  upcoming:{ color: '#22c55e', bg: 'rgba(34,197,94,0.06)', label: 'Good', icon: Check },
  notset:  { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', label: 'Set Date', icon: Calendar },
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InspectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeProperty, activePropertyId, loading: propLoading } = useProperty();
  const router = useRouter();

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [completeModal, setCompleteModal] = useState<Inspection | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !propLoading && !user) router.replace('/signin');
    if (!authLoading && !propLoading && user && !activePropertyId) router.replace('/onboarding');
  }, [user, authLoading, propLoading, activePropertyId, router]);

  // Subscribe
  useEffect(() => {
    if (!user || !activePropertyId) return;
    let isFirst = true;
    const unsub = subscribeToInspections(user.uid, activePropertyId, (items) => {
      setInspections(items);
      // Seed defaults on first load if empty
      if (isFirst && items.length === 0 && !seeded) {
        setSeeded(true);
        DEFAULT_INSPECTIONS.forEach(def => {
          addInspection(user.uid, activePropertyId, { ...def, propertyId: activePropertyId });
        });
      }
      isFirst = false;
    });
    return unsub;
  }, [user, activePropertyId, seeded]);

  // Sort: overdue first, then due, then upcoming, then notset
  const sorted = useMemo(() => {
    const order: Record<InspectionStatus, number> = { overdue: 0, due: 1, notset: 2, upcoming: 3 };
    return [...inspections].sort((a, b) => {
      const sa = getStatus(a.dueMonth);
      const sb = getStatus(b.dueMonth);
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      return a.name.localeCompare(b.name);
    });
  }, [inspections]);

  // Counts
  const dueCount = useMemo(() => inspections.filter(i => getStatus(i.dueMonth) === 'due').length, [inspections]);
  const overdueCount = useMemo(() => inspections.filter(i => getStatus(i.dueMonth) === 'overdue').length, [inspections]);
  const alertCount = dueCount + overdueCount;

  // Loading
  if (authLoading || propLoading || !user || !activePropertyId) {
    return <AppLayout><div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="loading-spinner" /></div></AppLayout>;
  }

  const handleMarkComplete = async (inspection: Inspection) => {
    const today = new Date().toISOString().split('T')[0];
    const nextDue = inspection.dueMonth
      ? addMonths(inspection.dueMonth, inspection.frequencyMonths)
      : addMonths(currentYM(), inspection.frequencyMonths);
    await updateInspection(user.uid, activePropertyId, inspection.id, {
      lastInspectedDate: today,
      dueMonth: nextDue,
    });
    setCompleteModal(null);
    showToast(`${inspection.name} marked complete — next due ${formatMonth(nextDue)}`);
  };

  const handleDelete = async (id: string) => {
    await deleteInspection(user.uid, activePropertyId, id);
    showToast('Inspection removed');
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '100px', alignItems: 'center' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, alignSelf: 'flex-start' }}>Inspections</h1>

        {/* Alert banner */}
        {alertCount > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '12px',
            padding: '14px 24px', borderRadius: 'var(--radius-lg)',
            background: overdueCount > 0
              ? 'linear-gradient(135deg, #dc2626, #ef4444)'
              : 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            color: '#fff',
          }}>
            <AlertTriangle size={20} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>
                {overdueCount > 0
                  ? `${overdueCount} Overdue Inspection${overdueCount !== 1 ? 's' : ''}`
                  : `${dueCount} Inspection${dueCount !== 1 ? 's' : ''} Due This Month`
                }
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                {overdueCount > 0 && dueCount > 0
                  ? `Plus ${dueCount} due this month`
                  : 'Tap an item to mark as inspected'
                }
              </div>
            </div>
          </div>
        )}

        {/* Inspection list */}
        <div style={{
          width: '100%', maxWidth: '700px',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {sorted.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <ClipboardCheck size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No inspections set up yet</p>
            </div>
          ) : (
            sorted.map(item => {
              const status = getStatus(item.dueMonth);
              const cfg = STATUS_CONFIG[status];
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => setCompleteModal(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    background: (status === 'overdue' || status === 'due') ? cfg.bg : undefined,
                    cursor: 'pointer',
                    transition: 'background 150ms',
                  }}
                >
                  {/* Status icon */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <StatusIcon size={18} color={cfg.color} />
                  </div>

                  {/* Name + details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                      <span>Due: <strong style={{ color: cfg.color }}>{formatMonth(item.dueMonth)}</strong></span>
                      {item.lastInspectedDate && (
                        <span>Last: {item.lastInspectedDate}</span>
                      )}
                      <span>Every {item.frequencyMonths}mo</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                    background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
                  }}>
                    {cfg.label}
                  </span>

                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        aria-label="Add Inspection"
        style={{
          position: 'fixed', bottom: '80px', right: '20px', zIndex: 30,
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'var(--navy)', color: '#fff', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(27,58,92,0.3)',
        }}
      >
        <Plus size={22} />
      </button>

      {/* Add Inspection Modal */}
      <AddInspectionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        uid={user.uid}
        pid={activePropertyId}
        onAdded={() => showToast('Inspection added')}
      />

      {/* Complete / Detail Modal */}
      {completeModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
          onClick={() => setCompleteModal(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface, #fff)', borderRadius: 'var(--radius-lg)',
              width: '100%', maxWidth: '380px', overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 20px 12px' }}>
              <div style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text-primary)' }}>
                {completeModal.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Due: <strong style={{ color: STATUS_CONFIG[getStatus(completeModal.dueMonth)].color }}>
                  {formatMonth(completeModal.dueMonth)}
                </strong>
                {' · '}Every {completeModal.frequencyMonths} months
              </div>
              {completeModal.lastInspectedDate && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Last inspected: {completeModal.lastInspectedDate}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => handleMarkComplete(completeModal)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--navy, #1b3a5c)', color: '#fff', border: 'none',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <Check size={16} />
                Mark as Inspected
              </button>
              <button
                onClick={() => { handleDelete(completeModal.id); setCompleteModal(null); }}
                style={{
                  width: '100%', padding: '10px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(220,38,38,0.06)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <Trash2 size={14} />
                Remove Inspection
              </button>
              <button
                onClick={() => setCompleteModal(null)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 'var(--radius-md)',
                  background: 'transparent', color: 'var(--text-muted)', border: 'none',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '140px', left: '50%', transform: 'translateX(-50%)',
          padding: '10px 20px', borderRadius: 'var(--radius-lg)',
          background: 'var(--navy)', color: '#fff',
          fontSize: '13px', fontWeight: 600, zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast}
        </div>
      )}
    </AppLayout>
  );
}

// ─── Add Inspection Modal ────────────────────────────────────────────────────

function AddInspectionModal({ isOpen, onClose, uid, pid, onAdded }: {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  pid: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [dueMonth, setDueMonth] = useState(currentYM());
  const [frequency, setFrequency] = useState('12');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await addInspection(uid, pid, {
        propertyId: pid,
        name: name.trim(),
        dueMonth,
        frequencyMonths: parseInt(frequency) || 12,
      });
      onAdded();
      onClose();
      setName(''); setDueMonth(currentYM()); setFrequency('12');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border)', background: 'var(--bg)',
    fontSize: '14px', color: 'var(--text-primary)',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Inspection">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Inspection Name *
          </label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fire Extinguisher" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Due Month
            </label>
            <input type="month" value={dueMonth} onChange={e => setDueMonth(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Frequency (months)
            </label>
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="1">Every month</option>
              <option value="3">Every 3 months</option>
              <option value="6">Every 6 months</option>
              <option value="12">Every 12 months</option>
              <option value="24">Every 2 years</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          className="btn btn-primary"
          style={{ marginTop: '4px', opacity: !name.trim() || saving ? 0.5 : 1 }}
        >
          {saving ? 'Saving...' : 'Add Inspection'}
        </button>
      </div>
    </Modal>
  );
}

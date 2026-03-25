'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { useLang } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { AppLayout } from '@/components/layout/AppLayout';
import { Modal } from '@/components/ui/Modal';
import {
  subscribeToWorkOrders,
  addWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  subscribeToPreventiveTasks,
  addPreventiveTask,
  updatePreventiveTask,
  deletePreventiveTask,
} from '@/lib/firestore';
import type { WorkOrder, WorkOrderSeverity, WorkOrderStatus, PreventiveTask } from '@/types';
import { Wrench, Plus, ChevronDown, ChevronUp, Trash2, Clock, CheckCircle, RefreshCw, AlertTriangle, CalendarCheck } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';

// ─── Severity config ────────────────────────────────────────────────────────

const SEVERITY: Record<WorkOrderSeverity, { label: string; labelEs: string; color: string; bg: string; border: string }> = {
  low:    { label: 'Low',    labelEs: 'Baja',    color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.25)' },
  medium: { label: 'Medium', labelEs: 'Media',   color: '#FBBF24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)'  },
  urgent: { label: 'Urgent', labelEs: 'Urgente', color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)'   },
};

const STATUS_CFG: Record<WorkOrderStatus, { color: string; bg: string; border: string }> = {
  submitted:   { color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.25)' },
  assigned:    { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)'  },
  in_progress: { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)'  },
  resolved:    { color: '#22C55E', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)'   },
};

const STATUS_LABEL: Record<WorkOrderStatus, { en: string; es: string }> = {
  submitted:   { en: 'Submitted',   es: 'Enviada'     },
  assigned:    { en: 'Assigned',    es: 'Asignada'    },
  in_progress: { en: 'In Progress', es: 'En Progreso' },
  resolved:    { en: 'Resolved',    es: 'Resuelta'    },
};

// ─── Preventive task helpers ─────────────────────────────────────────────────

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as any).toDate === 'function') return (v as any).toDate();
  return new Date(v as string);
}

function getNextDue(task: PreventiveTask): Date | null {
  const last = toDate(task.lastCompletedAt);
  if (!last) return null; // never done — treat as overdue
  return addDays(last, task.frequencyDays);
}

type TaskStatus = 'overdue' | 'due_soon' | 'ok';

function getTaskStatus(task: PreventiveTask): TaskStatus {
  const next = getNextDue(task);
  if (!next) return 'overdue'; // never done
  const daysLeft = differenceInDays(next, new Date());
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 7) return 'due_soon';
  return 'ok';
}

const TASK_STATUS_CFG: Record<TaskStatus, { color: string; bg: string; border: string; label: string; labelEs: string }> = {
  overdue:  { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.35)',   label: 'Overdue',   labelEs: 'Vencida'     },
  due_soon: { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.35)',  label: 'Due Soon',  labelEs: 'Por Vencer'  },
  ok:       { color: '#22C55E', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   label: 'On Track',  labelEs: 'Al Día'      },
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: '12px', padding: '14px 16px', marginBottom: '10px',
  cursor: 'pointer', transition: 'border-color 200ms',
};

const badge = (color: string, bg: string, border: string, label: string): React.ReactElement => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
    color, background: bg, border: `1px solid ${border}`, letterSpacing: '0.03em',
  }}>{label}</span>
);

// ─── Component ───────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const { user }                    = useAuth();
  const { activePropertyId, staff } = useProperty();
  const { lang }                    = useLang();

  // ── Top-level tab ──
  const [mainTab, setMainTab] = useState<'orders' | 'recurring'>('orders');

  // ── Work orders state ──
  const [orders,      setOrders]      = useState<WorkOrder[]>([]);
  const [filter,      setFilter]      = useState<'all' | 'open' | 'resolved'>('open');
  const [showAdd,     setShowAdd]     = useState(false);
  const [detailOrder, setDetailOrder] = useState<WorkOrder | null>(null);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [form, setForm] = useState({ roomNumber: '', description: '', severity: 'medium' as WorkOrderSeverity, submittedByName: '' });
  const [detailAssign, setDetailAssign] = useState('');
  const [detailNotes,  setDetailNotes]  = useState('');

  // ── Preventive tasks state ──
  const [tasks,          setTasks]          = useState<PreventiveTask[]>([]);
  const [showAddTask,    setShowAddTask]    = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showMarkDone,   setShowMarkDone]   = useState<PreventiveTask | null>(null);
  const [doneByName,     setDoneByName]     = useState('');
  const [taskForm, setTaskForm] = useState({ name: '', frequencyDays: 90, notes: '' });

  const [toast, setToast] = useState<string | null>(null);

  // ── Subscriptions ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !activePropertyId) return;
    return subscribeToWorkOrders(user.uid, activePropertyId, setOrders);
  }, [user, activePropertyId]);

  useEffect(() => {
    if (!user || !activePropertyId) return;
    return subscribeToPreventiveTasks(user.uid, activePropertyId, setTasks);
  }, [user, activePropertyId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered    = orders.filter(o => {
    if (filter === 'open')     return o.status !== 'resolved';
    if (filter === 'resolved') return o.status === 'resolved';
    return true;
  });
  const openCount   = orders.filter(o => o.status !== 'resolved').length;
  const urgentCount = orders.filter(o => o.severity === 'urgent' && o.status !== 'resolved').length;

  const sortedTasks = [...tasks].sort((a, b) => {
    const order = { overdue: 0, due_soon: 1, ok: 2 };
    return order[getTaskStatus(a)] - order[getTaskStatus(b)];
  });
  const overdueCount  = tasks.filter(t => getTaskStatus(t) === 'overdue').length;
  const dueSoonCount  = tasks.filter(t => getTaskStatus(t) === 'due_soon').length;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  // ── Work order actions ────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!user || !activePropertyId || !form.roomNumber.trim() || !form.description.trim()) return;
    await addWorkOrder(user.uid, activePropertyId, {
      propertyId: activePropertyId, roomNumber: form.roomNumber.trim(),
      description: form.description.trim(), severity: form.severity, status: 'submitted',
      submittedByName: form.submittedByName.trim() || undefined,
    });
    setForm({ roomNumber: '', description: '', severity: 'medium', submittedByName: '' });
    setShowAdd(false); showToast('Work order submitted');
  }

  async function handleStatusChange(order: WorkOrder, next: WorkOrderStatus) {
    if (!user || !activePropertyId) return;
    const extra: Partial<WorkOrder> = {};
    if (next === 'resolved') extra.resolvedAt = new Date();
    await updateWorkOrder(user.uid, activePropertyId, order.id, { status: next, ...extra });
  }

  async function handleAssign(order: WorkOrder) {
    if (!user || !activePropertyId) return;
    const member = staff.find(s => s.id === detailAssign);
    await updateWorkOrder(user.uid, activePropertyId, order.id, {
      status: 'assigned', assignedTo: detailAssign || undefined, assignedName: member?.name || undefined,
    });
    showToast('Assigned');
  }

  async function handleSaveNotes(order: WorkOrder) {
    if (!user || !activePropertyId) return;
    await updateWorkOrder(user.uid, activePropertyId, order.id, { notes: detailNotes });
    showToast('Notes saved');
  }

  async function handleDeleteOrder(id: string) {
    if (!user || !activePropertyId) return;
    await deleteWorkOrder(user.uid, activePropertyId, id);
    setDetailOrder(null); showToast('Deleted');
  }

  function openDetail(order: WorkOrder) {
    setDetailOrder(order); setDetailAssign(order.assignedTo || ''); setDetailNotes(order.notes || '');
  }

  // ── Preventive task actions ───────────────────────────────────────────────

  async function handleAddTask() {
    if (!user || !activePropertyId || !taskForm.name.trim()) return;
    await addPreventiveTask(user.uid, activePropertyId, {
      propertyId: activePropertyId, name: taskForm.name.trim(),
      frequencyDays: taskForm.frequencyDays, lastCompletedAt: null,
      notes: taskForm.notes.trim() || undefined,
    });
    setTaskForm({ name: '', frequencyDays: 90, notes: '' });
    setShowAddTask(false); showToast('Task added');
  }

  async function handleMarkDone() {
    if (!user || !activePropertyId || !showMarkDone) return;
    await updatePreventiveTask(user.uid, activePropertyId, showMarkDone.id, {
      lastCompletedAt: new Date(),
      lastCompletedBy: doneByName.trim() || undefined,
    });
    setShowMarkDone(null); setDoneByName('');
    showToast('Marked done — schedule reset ✓');
  }

  async function handleDeleteTask(tid: string) {
    if (!user || !activePropertyId) return;
    await deletePreventiveTask(user.uid, activePropertyId, tid);
    showToast('Task removed');
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wrench size={22} color="var(--amber)" />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {t('maintenance', lang)}
            </h1>
          </div>
          <button
            onClick={() => mainTab === 'orders' ? setShowAdd(true) : setShowAddTask(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--amber)', color: '#000',
              border: 'none', borderRadius: '10px',
              padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            {mainTab === 'orders' ? t('newWorkOrder', lang) : (lang === 'es' ? 'Nueva Tarea' : 'Add Task')}
          </button>
        </div>

        {/* ── Main tab switcher ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--surface)', borderRadius: '10px', padding: '4px' }}>
          {(['orders', 'recurring'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 150ms',
                background: mainTab === tab ? 'var(--amber)' : 'transparent',
                color: mainTab === tab ? '#000' : 'var(--text-muted)',
              }}
            >
              {tab === 'orders'
                ? (lang === 'es' ? 'Órdenes' : 'Work Orders')
                : (lang === 'es' ? 'Recurrentes' : 'Recurring')}
            </button>
          ))}
        </div>

        {/* ── Stats row ── */}
        {mainTab === 'orders' ? (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Open',   value: openCount,   color: openCount > 0 ? '#FBBF24' : '#22C55E', border: 'var(--border)' },
              { label: 'Urgent', value: urgentCount, color: urgentCount > 0 ? '#EF4444' : 'var(--text-muted)', border: urgentCount > 0 ? 'rgba(239,68,68,0.4)' : 'var(--border)' },
              { label: 'Total',  value: orders.length, color: 'var(--text)', border: 'var(--border)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--surface)', border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '26px', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: lang === 'es' ? 'Vencidas' : 'Overdue',  value: overdueCount,  color: overdueCount > 0 ? '#EF4444' : 'var(--text-muted)', border: overdueCount > 0 ? 'rgba(239,68,68,0.4)' : 'var(--border)' },
              { label: lang === 'es' ? 'Por Vencer' : 'Due Soon', value: dueSoonCount, color: dueSoonCount > 0 ? '#FBBF24' : 'var(--text-muted)', border: dueSoonCount > 0 ? 'rgba(251,191,36,0.4)' : 'var(--border)' },
              { label: lang === 'es' ? 'Total' : 'Total',        value: tasks.length,  color: 'var(--text)', border: 'var(--border)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--surface)', border: `1px solid ${s.border}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '26px', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Work order filter tabs ── */}
        {mainTab === 'orders' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {(['open', 'all', 'resolved'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                border: filter === f ? '1px solid var(--amber)' : '1px solid var(--border)',
                background: filter === f ? 'rgba(212,144,64,0.12)' : 'transparent',
                color: filter === f ? 'var(--amber)' : 'var(--text-muted)', cursor: 'pointer',
              }}>
                {f === 'open' ? t('openOrders', lang) : f === 'resolved' ? t('resolved', lang) : t('allOrders', lang)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Work Orders list ── */}
      {mainTab === 'orders' && (
        <div style={{ padding: '0 16px 120px' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: '14px' }}>
              <Wrench size={32} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.4 }} />
              <div>No {filter === 'resolved' ? 'resolved' : 'open'} work orders</div>
            </div>
          )}
          {filtered.map(order => {
            const sev = SEVERITY[order.severity];
            const sta = STATUS_CFG[order.status];
            const isExpanded = expandedId === order.id;
            return (
              <div key={order.id} style={{ ...card, borderColor: order.severity === 'urgent' && order.status !== 'resolved' ? 'rgba(239,68,68,0.35)' : 'var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }} onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Room {order.roomNumber}</span>
                      {badge(sev.color, sev.bg, sev.border, lang === 'es' ? sev.labelEs : sev.label)}
                      {badge(sta.color, sta.bg, sta.border, STATUS_LABEL[order.status][lang])}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '4px' }}>{order.description}</div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {order.assignedName && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>→ {order.assignedName}</span>}
                      {order.createdAt && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{format(toDate(order.createdAt)!, 'MMM d, h:mm a')}</span>}
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', flexShrink: 0, paddingTop: '2px' }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    {order.status !== 'resolved' && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {(order.status === 'submitted' || order.status === 'assigned') && (
                          <button onClick={() => handleStatusChange(order, 'in_progress')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#3B82F6', cursor: 'pointer' }}>
                            <Clock size={13} /> {t('markInProgress', lang)}
                          </button>
                        )}
                        <button onClick={() => handleStatusChange(order, 'resolved')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', cursor: 'pointer' }}>
                          <CheckCircle size={13} /> {t('markResolved', lang)}
                        </button>
                        <button onClick={() => openDetail(order)} style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          Assign / Notes
                        </button>
                      </div>
                    )}
                    {order.notes && <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>📝 {order.notes}</div>}
                    {order.status === 'resolved' && order.resolvedAt && <div style={{ fontSize: '12px', color: '#22C55E', marginBottom: '8px' }}>✓ Resolved {format(toDate(order.resolvedAt)!, 'MMM d, h:mm a')}</div>}
                    <button onClick={() => handleDeleteOrder(order.id)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', cursor: 'pointer' }}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Recurring tasks list ── */}
      {mainTab === 'recurring' && (
        <div style={{ padding: '0 16px 120px' }}>
          {sortedTasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: '14px' }}>
              <CalendarCheck size={32} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>{lang === 'es' ? 'Sin tareas recurrentes' : 'No recurring tasks yet'}</div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>{lang === 'es' ? 'Agrega tareas como cambio de filtros HVAC, revisión de extintores, etc.' : 'Add tasks like HVAC filter changes, fire extinguisher checks, etc.'}</div>
            </div>
          )}
          {sortedTasks.map(task => {
            const tStatus = getTaskStatus(task);
            const cfg     = TASK_STATUS_CFG[tStatus];
            const nextDue = getNextDue(task);
            const last    = toDate(task.lastCompletedAt);
            const isExpanded = expandedTaskId === task.id;

            let dueLabel = '';
            if (!nextDue) {
              dueLabel = lang === 'es' ? 'Nunca realizada' : 'Never completed';
            } else {
              const days = differenceInDays(nextDue, new Date());
              if (days < 0)      dueLabel = lang === 'es' ? `Venció hace ${Math.abs(days)} días` : `Overdue by ${Math.abs(days)} days`;
              else if (days === 0) dueLabel = lang === 'es' ? 'Vence hoy' : 'Due today';
              else if (days === 1) dueLabel = lang === 'es' ? 'Vence mañana' : 'Due tomorrow';
              else                 dueLabel = lang === 'es' ? `Vence en ${days} días` : `Due in ${days} days`;
            }

            return (
              <div key={task.id} style={{ ...card, borderColor: tStatus === 'overdue' ? 'rgba(239,68,68,0.35)' : tStatus === 'due_soon' ? 'rgba(251,191,36,0.35)' : 'var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }} onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{task.name}</span>
                      {badge(cfg.color, cfg.bg, cfg.border, lang === 'es' ? cfg.labelEs : cfg.label)}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: cfg.color, fontWeight: 600 }}>
                        {tStatus === 'overdue' && <AlertTriangle size={10} style={{ display:'inline', marginRight:'3px', verticalAlign:'middle' }} />}
                        {dueLabel}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        <RefreshCw size={10} style={{ display:'inline', marginRight:'3px', verticalAlign:'middle' }} />
                        {lang === 'es' ? `Cada ${task.frequencyDays} días` : `Every ${task.frequencyDays} days`}
                      </span>
                    </div>
                    {last && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {lang === 'es' ? 'Última vez:' : 'Last done:'} {format(last, 'MMM d, yyyy')}{task.lastCompletedBy ? ` · ${task.lastCompletedBy}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)', flexShrink: 0, paddingTop: '2px' }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {task.notes && <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px' }}>📝 {task.notes}</div>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => { setShowMarkDone(task); setDoneByName(''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', cursor: 'pointer' }}
                      >
                        <CheckCircle size={13} /> {lang === 'es' ? 'Marcar Hecho' : 'Mark Done'}
                      </button>
                      <button onClick={() => handleDeleteTask(task.id)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', borderRadius: '8px', fontSize: '12px', background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', cursor: 'pointer' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Work Order Modal ── */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title={t('newWorkOrder', lang)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Room Number *</label>
            <input value={form.roomNumber} onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))} placeholder="e.g. 214" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '15px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Description *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue..." rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{t('severity', lang)}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['low', 'medium', 'urgent'] as WorkOrderSeverity[]).map(s => {
                const cfg = SEVERITY[s]; const active = form.severity === s;
                return <button key={s} onClick={() => setForm(f => ({ ...f, severity: s }))} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: active ? `1px solid ${cfg.color}` : '1px solid var(--border)', background: active ? cfg.bg : 'transparent', color: active ? cfg.color : 'var(--text-muted)', cursor: 'pointer' }}>{lang === 'es' ? cfg.labelEs : cfg.label}</button>;
              })}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{t('submittedBy', lang)} (optional)</label>
            <input value={form.submittedByName} onChange={e => setForm(f => ({ ...f, submittedByName: e.target.value }))} placeholder="Staff name" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('cancel', lang)}</button>
            <button onClick={handleSubmit} disabled={!form.roomNumber.trim() || !form.description.trim()} style={{ flex: 2, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, background: form.roomNumber.trim() && form.description.trim() ? 'var(--amber)' : 'var(--border)', color: form.roomNumber.trim() && form.description.trim() ? '#000' : 'var(--text-muted)', border: 'none', cursor: form.roomNumber.trim() && form.description.trim() ? 'pointer' : 'not-allowed' }}>Submit Work Order</button>
          </div>
        </div>
      </Modal>

      {/* ── Add Recurring Task Modal ── */}
      <Modal isOpen={showAddTask} onClose={() => setShowAddTask(false)} title={lang === 'es' ? 'Nueva Tarea Recurrente' : 'New Recurring Task'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{lang === 'es' ? 'Nombre de la tarea *' : 'Task name *'}</label>
            <input
              value={taskForm.name}
              onChange={e => setTaskForm(f => ({ ...f, name: e.target.value }))}
              placeholder={lang === 'es' ? 'ej. Cambio de filtros HVAC' : 'e.g. Replace HVAC Filters'}
              autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{lang === 'es' ? 'Frecuencia (días)' : 'Frequency (days)'}</label>
            {/* Quick presets */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {[30, 60, 90, 180, 365].map(d => (
                <button key={d} onClick={() => setTaskForm(f => ({ ...f, frequencyDays: d }))} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: taskForm.frequencyDays === d ? '1px solid var(--amber)' : '1px solid var(--border)', background: taskForm.frequencyDays === d ? 'rgba(212,144,64,0.12)' : 'transparent', color: taskForm.frequencyDays === d ? 'var(--amber)' : 'var(--text-muted)', cursor: 'pointer' }}>
                  {d === 30 ? '30d' : d === 60 ? '60d' : d === 90 ? '90d' : d === 180 ? '6mo' : '1yr'}
                </button>
              ))}
            </div>
            <input type="number" value={taskForm.frequencyDays} onChange={e => setTaskForm(f => ({ ...f, frequencyDays: Math.max(1, parseInt(e.target.value) || 1) }))} min={1} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{lang === 'es' ? 'Notas (opcional)' : 'Notes (optional)'}</label>
            <input value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} placeholder={lang === 'es' ? 'ej. Usar filtros MERV-13' : 'e.g. Use MERV-13 filters'} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button onClick={() => setShowAddTask(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('cancel', lang)}</button>
            <button onClick={handleAddTask} disabled={!taskForm.name.trim()} style={{ flex: 2, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, background: taskForm.name.trim() ? 'var(--amber)' : 'var(--border)', color: taskForm.name.trim() ? '#000' : 'var(--text-muted)', border: 'none', cursor: taskForm.name.trim() ? 'pointer' : 'not-allowed' }}>
              {lang === 'es' ? 'Agregar Tarea' : 'Add Task'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Mark Done Modal ── */}
      <Modal isOpen={!!showMarkDone} onClose={() => setShowMarkDone(null)} title={lang === 'es' ? 'Marcar como Hecho' : 'Mark as Done'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {showMarkDone?.name} — {lang === 'es' ? 'el contador se reiniciará hoy.' : 'the schedule will reset from today.'}
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{lang === 'es' ? 'Completado por (opcional)' : 'Completed by (optional)'}</label>
            <input value={doneByName} onChange={e => setDoneByName(e.target.value)} placeholder={lang === 'es' ? 'Tu nombre...' : 'Your name...'} autoFocus onKeyDown={e => e.key === 'Enter' && handleMarkDone()} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowMarkDone(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('cancel', lang)}</button>
            <button onClick={handleMarkDone} style={{ flex: 2, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, background: '#22C55E', color: '#000', border: 'none', cursor: 'pointer' }}>
              <CheckCircle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              {lang === 'es' ? 'Confirmar' : 'Confirm Done'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Detail / Assign Modal ── */}
      {detailOrder && (
        <Modal isOpen={!!detailOrder} onClose={() => setDetailOrder(null)} title={`Room ${detailOrder.roomNumber}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{detailOrder.description}</div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{t('assignTo', lang)}</label>
              <select value={detailAssign} onChange={e => setDetailAssign(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px' }}>
                <option value="">Unassigned</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={() => handleAssign(detailOrder)} style={{ marginTop: '8px', width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--amber)', color: '#000', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{t('save', lang)} Assignment</button>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{t('workOrderNotes', lang)}</label>
              <textarea value={detailNotes} onChange={e => setDetailNotes(e.target.value)} placeholder="Add internal notes..." rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              <button onClick={() => handleSaveNotes(detailOrder)} style={{ marginTop: '8px', width: '100%', padding: '10px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Save Notes</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {toast}
        </div>
      )}
    </AppLayout>
  );
}

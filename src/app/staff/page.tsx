'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { addStaffMember, updateStaffMember, deleteStaffMember } from '@/lib/firestore';
import { Modal } from '@/components/ui/Modal';
import type { StaffMember } from '@/types';
import { Users, Plus, Pencil, Trash2, Star, AlertTriangle, Clock } from 'lucide-react';

interface StaffFormData {
  name: string;
  phone?: string;
  language: 'en' | 'es';
  isSenior: boolean;
  hourlyWage?: number;
  maxWeeklyHours: number;
}

const EMPTY_FORM: StaffFormData = {
  name: '',
  language: 'en',
  isSenior: false,
  maxWeeklyHours: 40,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function StaffPage() {
  const { user } = useAuth();
  const { activePropertyId, staff } = useProperty();

  const [showModal, setShowModal] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditMember(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditMember(member);
    setForm({
      name: member.name,
      phone: member.phone,
      language: member.language,
      isSenior: member.isSenior,
      hourlyWage: member.hourlyWage,
      maxWeeklyHours: member.maxWeeklyHours,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!user || !activePropertyId || !form.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        ...(form.phone && { phone: form.phone }),
        language: form.language,
        isSenior: form.isSenior,
        ...(form.hourlyWage !== undefined && { hourlyWage: form.hourlyWage }),
        maxWeeklyHours: form.maxWeeklyHours,
      };

      if (editMember) {
        await updateStaffMember(user.uid, activePropertyId, editMember.id, data);
      } else {
        await addStaffMember(user.uid, activePropertyId, {
          ...data,
          scheduledToday: false,
          weeklyHours: 0,
        });
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (member: StaffMember) => {
    if (window.confirm(`Delete ${member.name}?`)) {
      if (!user || !activePropertyId) return;
      deleteStaffMember(user.uid, activePropertyId, member.id);
    }
  };

  const toggleScheduledToday = async (member: StaffMember) => {
    if (!user || !activePropertyId) return;
    await updateStaffMember(user.uid, activePropertyId, member.id, {
      scheduledToday: !member.scheduledToday,
    });
  };

  // Stats & sorting
  const totalStaff = staff.length;
  const scheduledToday = staff.filter(s => s.scheduledToday).length;
  const nearOvertime = staff.filter(s => s.weeklyHours >= s.maxWeeklyHours - 8).length;

  const hasOvertimeWarning = staff.some(s => s.weeklyHours >= s.maxWeeklyHours - 4);

  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => {
      if (a.scheduledToday !== b.scheduledToday) {
        return a.scheduledToday ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [staff]);

  return (
    <AppLayout>
      <div style={{ padding: '16px', maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: '24px',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: 0,
            }}
          >
            <Users size={20} color="var(--amber)" />
            Staff Roster
          </h1>
          <button
            onClick={openAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              background: 'var(--amber)',
              color: '#0A0A0A',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} />
            Add Staff
          </button>
        </div>

        {/* Stats header */}
        {totalStaff > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Total Staff
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--amber)' }}>
                {totalStaff}
              </div>
            </div>
            <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Scheduled Today
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--green)' }}>
                {scheduledToday}
              </div>
            </div>
            <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Near Overtime
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: nearOvertime > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
                {nearOvertime}
              </div>
            </div>
          </div>
        )}

        {/* Overtime warning banner */}
        {hasOvertimeWarning && (
          <div
            className="animate-in"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px',
              background: 'rgba(251, 191, 36, 0.08)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
            }}
          >
            <AlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--amber)', margin: 0 }}>
                Overtime Alert
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                One or more staff members are approaching or exceeding their maximum weekly hours.
              </p>
            </div>
          </div>
        )}

        {/* Staff grid or empty state */}
        {staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <Users size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
              No staff added yet. Add your first housekeeper to get started.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {sortedStaff.map((member, idx) => {
              const utilizationPct = Math.round((member.weeklyHours / member.maxWeeklyHours) * 100);
              const atOrOverMax = member.weeklyHours >= member.maxWeeklyHours;
              const nearMax = member.weeklyHours >= member.maxWeeklyHours - 4;

              return (
                <div
                  key={member.id}
                  className="animate-in"
                  style={{
                    animationDelay: `${idx * 50}ms`,
                    borderColor: nearMax ? 'rgba(251, 191, 36, 0.3)' : 'var(--border)',
                    background: nearMax ? 'rgba(251, 191, 36, 0.04)' : 'var(--bg-card)',
                  }}
                >
                  <div
                    className="card"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      height: '100%',
                    }}
                  >
                    {/* Avatar + name + badges */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--amber)',
                          color: '#0A0A0A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '14px',
                          flexShrink: 0,
                        }}
                      >
                        {initials(member.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 4px' }}>
                          {member.name}
                        </p>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            className="chip"
                            style={{
                              fontSize: '10px',
                              padding: '2px 7px',
                              background: member.language === 'es' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: member.language === 'es' ? 'var(--green)' : 'var(--blue)',
                            }}
                          >
                            {member.language === 'es' ? 'ES' : 'EN'}
                          </span>
                          {member.isSenior && (
                            <span
                              className="chip"
                              style={{
                                fontSize: '10px',
                                padding: '2px 7px',
                                background: 'rgba(251, 191, 36, 0.15)',
                                color: 'var(--amber)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <Star size={9} />
                              Senior
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hours & progress bar */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          marginBottom: '6px',
                        }}
                      >
                        <span>
                          {member.weeklyHours}h / {member.maxWeeklyHours}h
                        </span>
                        <span style={{ color: atOrOverMax ? 'var(--red)' : nearMax ? 'var(--amber)' : 'var(--text-muted)' }}>
                          {Math.max(0, member.maxWeeklyHours - member.weeklyHours)}h left
                        </span>
                      </div>
                      <div
                        className="progress-track"
                        style={{
                          height: '4px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(utilizationPct, 100)}%`,
                            height: '100%',
                            background:
                              utilizationPct > 100
                                ? 'var(--red)'
                                : utilizationPct > 90
                                  ? 'var(--amber)'
                                  : 'var(--green)',
                            borderRadius: '2px',
                          }}
                        />
                      </div>
                    </div>

                    {/* Scheduled today toggle */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px',
                        background: member.scheduledToday
                          ? 'rgba(34, 197, 94, 0.08)'
                          : 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid ' + (member.scheduledToday ? 'rgba(34, 197, 94, 0.2)' : 'var(--border)'),
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => toggleScheduledToday(member)}
                    >
                      <Clock
                        size={14}
                        color={member.scheduledToday ? 'var(--green)' : 'var(--text-muted)'}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: '13px',
                          fontWeight: 500,
                          color: member.scheduledToday ? 'var(--green)' : 'var(--text-secondary)',
                        }}
                      >
                        {member.scheduledToday ? 'Scheduled Today' : 'Not Scheduled'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => openEdit(member)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontFamily: 'var(--font-sans)',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--red)',
                          fontWeight: 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-sans)',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editMember ? `Edit ${editMember.name}` : 'Add Staff Member'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="label">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="input"
                placeholder="Maria Garcia"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Phone (optional)</label>
              <input
                type="tel"
                value={form.phone ?? ''}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="input"
                placeholder="(409) 555-1234"
              />
            </div>

            <div>
              <label className="label">Language</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['en', 'es'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => setForm(f => ({ ...f, language: lang as 'en' | 'es' }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: `1px solid ${form.language === lang ? 'var(--amber)' : 'var(--border)'}`,
                      background: form.language === lang ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                      color: form.language === lang ? 'var(--amber)' : 'var(--text-secondary)',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                    }}
                  >
                    {lang === 'en' ? 'English' : 'Español'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Hourly Wage (optional)</label>
              <input
                type="number"
                value={form.hourlyWage ?? ''}
                onChange={e => setForm(f => ({ ...f, hourlyWage: e.target.value ? parseFloat(e.target.value) : undefined }))}
                className="input"
                placeholder="15.00"
                step="0.50"
                min="0"
              />
            </div>

            <div>
              <label className="label">Max Weekly Hours</label>
              <input
                type="number"
                value={form.maxWeeklyHours}
                onChange={e => setForm(f => ({ ...f, maxWeeklyHours: parseInt(e.target.value) || 40 }))}
                className="input"
                placeholder="40"
                min="1"
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Senior Staff</span>
              <label
                className="toggle"
                style={{ margin: 0 }}
              >
                <input
                  type="checkbox"
                  checked={form.isSenior}
                  onChange={e => setForm(f => ({ ...f, isSenior: e.target.checked }))}
                />
                <span className="toggle-track" />
                <span className="toggle-thumb" />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: saving || !form.name.trim() ? 'rgba(251, 191, 36, 0.4)' : 'var(--amber)',
                  color: saving || !form.name.trim() ? 'rgba(10, 10, 10, 0.4)' : '#0A0A0A',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {saving ? 'Saving...' : editMember ? 'Update' : 'Add Staff'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}

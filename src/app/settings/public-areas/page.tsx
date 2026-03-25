'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { useLang } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { setPublicArea, deletePublicArea } from '@/lib/firestore';
import { isAreaDueToday } from '@/lib/calculations';
import { getFloorLabel, generateId } from '@/lib/utils';
import type { PublicArea } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { MapPin, Plus, Trash2, Edit2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { t } from '@/lib/translations';
import { format } from 'date-fns';

const FLOORS = ['1', '2', '3', '4', 'exterior'];

const EMPTY_AREA: Omit<PublicArea, 'id'> = {
  name: '',
  floor: '1',
  locations: 1,
  frequencyDays: 1,
  minutesPerClean: 30,
  startDate: format(new Date(), 'yyyy-MM-dd'),
  onlyWhenRented: false,
  isRentedToday: false,
};

export default function PublicAreasPage() {
  const { user } = useAuth();
  const { activePropertyId, publicAreas, refreshPublicAreas } = useProperty();
  const { lang } = useLang();

  const [showModal, setShowModal] = useState(false);
  const [editArea, setEditArea] = useState<PublicArea | null>(null);
  const [form, setForm] = useState<Omit<PublicArea, 'id'>>(EMPTY_AREA);
  const [saving, setSaving] = useState(false);

  const today = new Date();

  const openAdd = (floor = '1') => {
    setEditArea(null);
    setForm({ ...EMPTY_AREA, floor });
    setShowModal(true);
  };

  const openEdit = (area: PublicArea) => {
    setEditArea(area);
    setForm({ ...area });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!user || !activePropertyId || !form.name.trim()) return;
    setSaving(true);
    try {
      const id = editArea?.id ?? generateId();
      await setPublicArea(user.uid, activePropertyId, { ...form, id });
      await refreshPublicAreas();
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !activePropertyId) return;
    await deletePublicArea(user.uid, activePropertyId, id);
    await refreshPublicAreas();
  };

  const totalDueMinutes = publicAreas
    .filter(a => isAreaDueToday(a, today))
    .reduce((s, a) => s + a.locations * a.minutesPerClean, 0);

  return (
    <AppLayout>
      <div style={{ padding: '16px', maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/settings" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px' }}>← Settings</Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} color="var(--amber)" /> Public Areas
            </h1>
          </div>
          <button onClick={() => openAdd()} className="btn btn-primary btn-sm">
            <Plus size={14} /> Add Area
          </button>
        </div>

        {/* Today's summary */}
        <div className="card card-amber" style={{ padding: '14px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '2px' }}>Due Today</p>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {publicAreas.filter(a => isAreaDueToday(a, today)).length} areas · {totalDueMinutes} minutes total
            </p>
          </div>
          <CheckCircle size={18} color="var(--amber)" />
        </div>

        {/* Grouped by floor */}
        {FLOORS.map(floor => {
          const floorAreas = publicAreas.filter(a => a.floor === floor);
          if (floorAreas.length === 0) return null;
          return (
            <div key={floor} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {getFloorLabel(floor, lang)}
                </p>
                <button onClick={() => openAdd(floor)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--amber)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={12} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {floorAreas.map(area => {
                  const isDue = isAreaDueToday(area, today);
                  return (
                    <div
                      key={area.id}
                      className="card"
                      style={{
                        padding: '12px 14px',
                        borderColor: isDue ? 'rgba(212,144,64,0.25)' : 'var(--border)',
                        background: isDue ? 'rgba(212,144,64,0.04)' : undefined,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          {isDue && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />}
                          <span style={{ fontSize: '14px', fontWeight: 500, color: isDue ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {area.name}
                          </span>
                          {area.onlyWhenRented && (
                            <span style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '100px', flexShrink: 0 }}>
                              rented only
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {area.locations} loc × {area.minutesPerClean}min · every {area.frequencyDays}d
                        </p>
                      </div>
                      <button onClick={() => openEdit(area)} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px', flexShrink: 0 }}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(area.id)} className="btn btn-danger btn-sm" style={{ padding: '6px 8px', flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Add/Edit modal */}
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editArea ? 'Edit Area' : 'Add Public Area'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="label">Area Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="e.g. Fitness Center" autoFocus />
            </div>
            <div>
              <label className="label">Floor</label>
              <select value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} className="input">
                {FLOORS.map(fl => <option key={fl} value={fl}>{getFloorLabel(fl)}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label className="label">Locations</label>
                <input type="number" min={1} value={form.locations} onChange={e => setForm(f => ({ ...f, locations: Number(e.target.value) }))} className="input" />
              </div>
              <div>
                <label className="label">Every X Days</label>
                <input type="number" min={1} value={form.frequencyDays} onChange={e => setForm(f => ({ ...f, frequencyDays: Number(e.target.value) }))} className="input" />
              </div>
              <div>
                <label className="label">Min/Clean</label>
                <input type="number" min={1} value={form.minutesPerClean} onChange={e => setForm(f => ({ ...f, minutesPerClean: Number(e.target.value) }))} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Cycle Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="input" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <span style={{ fontSize: '14px' }}>Only clean when rented</span>
              <label className="toggle" style={{ margin: 0 }}>
                <input type="checkbox" checked={form.onlyWhenRented ?? false} onChange={e => setForm(f => ({ ...f, onlyWhenRented: e.target.checked }))} />
                <span className="toggle-track" />
                <span className="toggle-thumb" />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Modal } from '@/components/ui/Modal';
import {
  subscribeToInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '@/lib/firestore';
import type { InventoryItem, InventoryCategory } from '@/types';
import { Package, Plus, Trash2, Edit2, AlertTriangle } from 'lucide-react';

type FilterCategory = 'all' | InventoryCategory;

const CATEGORY_COLORS: Record<InventoryCategory, { bg: string; text: string; dot: string }> = {
  linens: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', dot: '#3b82f6' },
  towels: { bg: 'rgba(34, 211, 238, 0.1)', text: '#22d3ee', dot: '#22d3ee' },
  amenities: { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7', dot: '#a855f7' },
  cleaning: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', dot: '#22c55e' },
  maintenance: { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c', dot: '#fb923c' },
  other: { bg: 'rgba(107, 114, 128, 0.1)', text: '#6b7280', dot: '#6b7280' },
};

const EMPTY_ITEM: Omit<InventoryItem, 'id' | 'propertyId' | 'updatedAt'> = {
  name: '',
  category: 'linens',
  currentStock: 0,
  parLevel: 10,
  unit: 'sets',
  notes: '',
};

export default function InventoryPage() {
  const { user } = useAuth();
  const { activePropertyId, activeProperty } = useProperty();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<Omit<InventoryItem, 'id' | 'propertyId' | 'updatedAt'>>(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Real-time subscription to inventory
  useEffect(() => {
    if (!user || !activePropertyId) return;

    const unsubscribe = subscribeToInventory(user.uid, activePropertyId, (data) => {
      setItems(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activePropertyId]);

  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_ITEM);
    setShowModal(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      parLevel: item.parLevel,
      unit: item.unit,
      notes: item.notes,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!user || !activePropertyId || !form.name.trim()) return;
    setSaving(true);
    try {
      const cleanData = {
        name: form.name.trim(),
        category: form.category,
        currentStock: form.currentStock,
        parLevel: form.parLevel,
        unit: form.unit.trim(),
        notes: form.notes?.trim(),
      };

      // Remove undefined/empty notes
      const dataToSave = Object.fromEntries(
        Object.entries(cleanData).filter(([, v]) => v !== undefined && v !== '')
      ) as Partial<typeof cleanData>;

      if (editItem) {
        await updateInventoryItem(user.uid, activePropertyId, editItem.id, dataToSave);
      } else {
        await addInventoryItem(user.uid, activePropertyId, {
          ...cleanData,
          propertyId: activePropertyId,
        });
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !activePropertyId) return;
    await deleteInventoryItem(user.uid, activePropertyId, id);
  };

  const handleQuickUpdate = async (item: InventoryItem, delta: number) => {
    if (!user || !activePropertyId) return;
    const newStock = Math.max(0, item.currentStock + delta);
    await updateInventoryItem(user.uid, activePropertyId, item.id, { currentStock: newStock });
  };

  // Filter items
  const filteredItems = filter === 'all'
    ? items
    : items.filter(i => i.category === filter);

  // Sort: low stock first, then by category, then by name
  const sortedItems = [...filteredItems].sort((a, b) => {
    const aLow = a.currentStock < a.parLevel;
    const bLow = b.currentStock < b.parLevel;
    if (aLow !== bLow) return aLow ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  // Stats
  const lowStockCount = items.filter(i => i.currentStock < i.parLevel).length;
  const okCount = items.filter(i => i.currentStock >= i.parLevel).length;

  // Stock level color
  const getStockColor = (current: number, par: number) => {
    if (current >= par) return '#22c55e';
    if (current >= par * 0.8) return '#fbbf24';
    return '#ef4444';
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--amber)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto',
            }}
          />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 800,
                fontSize: '2rem',
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Package size={26} color="var(--amber)" />
              Inventory
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              {activeProperty?.name} • {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <button onClick={openAdd} className="btn btn-primary btn-sm">
            <Plus size={14} /> Add Item
          </button>
        </div>

        {/* Filter chips */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '8px' }}>
            {(['all', 'linens', 'towels', 'amenities', 'cleaning', 'maintenance', 'other'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={filter === cat ? 'chip chip-active' : 'chip'}
                style={{
                  textTransform: 'capitalize',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Stats row */}
        {items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
              <p className="label" style={{ fontSize: '11px' }}>Total Items</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--text-secondary)' }}>
                {items.length}
              </div>
            </div>
            <div className="card" style={{ padding: '14px 12px', textAlign: 'center', borderColor: lowStockCount > 0 ? 'rgba(251,146,60,0.3)' : 'var(--border)' }}>
              <p className="label" style={{ fontSize: '11px' }}>Low Stock</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.5rem', color: lowStockCount > 0 ? '#fb923c' : 'var(--text-secondary)' }}>
                {lowStockCount}
              </div>
            </div>
            <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
              <p className="label" style={{ fontSize: '11px' }}>OK Stock</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.5rem', color: '#22c55e' }}>
                {okCount}
              </div>
            </div>
          </div>
        )}

        {/* Low stock alert banner */}
        {lowStockCount > 0 && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              <strong style={{ color: '#ef4444' }}>{lowStockCount} {lowStockCount === 1 ? 'item' : 'items'} below par level</strong> — reorder soon
            </p>
          </div>
        )}

        {/* Items list */}
        {sortedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <Package size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '16px' }}>
              {items.length === 0 ? 'No inventory items yet.' : `No items in ${filter} category.`}
            </p>
            {items.length === 0 && (
              <button onClick={openAdd} className="btn btn-primary btn-sm" style={{ marginTop: '12px' }}>
                Add your first item
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sortedItems.map(item => {
              const isLow = item.currentStock < item.parLevel;
              const pct = item.parLevel > 0 ? Math.min((item.currentStock / item.parLevel) * 100, 100) : 0;
              const colors = CATEGORY_COLORS[item.category];
              const stockColor = getStockColor(item.currentStock, item.parLevel);

              return (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    padding: '16px',
                    borderColor: isLow ? 'rgba(239, 68, 68, 0.2)' : 'var(--border)',
                    background: isLow ? 'rgba(239, 68, 68, 0.03)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Category dot */}
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: 'var(--radius-full)',
                        background: colors.dot,
                        marginTop: '8px',
                        flexShrink: 0,
                      }}
                    />

                    {/* Main content */}
                    <div style={{ flex: 1 }}>
                      {/* Name + unit */}
                      <div style={{ marginBottom: '8px' }}>
                        <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                          {item.name}
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          per {item.unit}
                        </p>
                      </div>

                      {/* Stock display */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.8rem', color: stockColor }}>
                          {item.currentStock}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          par level: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{item.parLevel}</span>
                        </p>
                      </div>

                      {/* Progress bar */}
                      <div className="progress-track" style={{ height: '4px', marginBottom: '12px' }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${pct}%`,
                            background: stockColor,
                          }}
                        />
                      </div>

                      {/* Notes */}
                      {item.notes && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontStyle: 'italic' }}>
                          {item.notes}
                        </p>
                      )}

                      {/* Quick adjust & actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* +/- buttons */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleQuickUpdate(item, -1)}
                            className="btn btn-secondary btn-xs"
                            style={{ width: '28px', padding: 0 }}
                          >
                            −
                          </button>
                          <button
                            onClick={() => handleQuickUpdate(item, 1)}
                            className="btn btn-secondary btn-xs"
                            style={{ width: '28px', padding: 0 }}
                          >
                            +
                          </button>
                        </div>

                        {/* Edit & delete */}
                        <button
                          onClick={() => openEdit(item)}
                          className="btn btn-secondary btn-xs"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="btn btn-secondary btn-xs"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Edit Item' : 'Add Inventory Item'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name */}
          <div>
            <label className="label" style={{ marginBottom: '6px' }}>
              Item Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Bath Towels, Cleaning Spray"
              className="input-mono"
              style={{ width: '100%' }}
            />
          </div>

          {/* Category */}
          <div>
            <label className="label" style={{ marginBottom: '8px' }}>
              Category
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['linens', 'towels', 'amenities', 'cleaning', 'maintenance', 'other'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setForm({ ...form, category: cat })}
                  className={form.category === cat ? 'chip chip-active' : 'chip'}
                  style={{
                    textTransform: 'capitalize',
                    fontSize: '13px',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className="label" style={{ marginBottom: '6px' }}>
              Unit <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>e.g., sets, bottles, pieces</span>
            </label>
            <input
              type="text"
              value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
              placeholder="sets"
              className="input-mono"
              style={{ width: '100%' }}
            />
          </div>

          {/* Current Stock & Par Level */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="label" style={{ marginBottom: '6px' }}>
                Current Stock
              </label>
              <input
                type="number"
                value={form.currentStock}
                onChange={e => setForm({ ...form, currentStock: Math.max(0, parseInt(e.target.value) || 0) })}
                min="0"
                className="input-mono"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="label" style={{ marginBottom: '6px' }}>
                Par Level
              </label>
              <input
                type="number"
                value={form.parLevel}
                onChange={e => setForm({ ...form, parLevel: Math.max(1, parseInt(e.target.value) || 1) })}
                min="1"
                className="input-mono"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label" style={{ marginBottom: '6px' }}>
              Notes <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>optional</span>
            </label>
            <textarea
              value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g., Store in linen room, order from vendor A"
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '10px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              onClick={() => setShowModal(false)}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="btn btn-primary"
              style={{ flex: 1, opacity: saving || !form.name.trim() ? 0.5 : 1 }}
            >
              {saving ? 'Saving...' : editItem ? 'Update' : 'Add Item'}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

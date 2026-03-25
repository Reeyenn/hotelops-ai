'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { setLaundryCategory } from '@/lib/firestore';
import type { LaundryCategory } from '@/types';
import { RefreshCw, Check } from 'lucide-react';
import Link from 'next/link';

export default function LaundrySettingsPage() {
  const { user } = useAuth();
  const { activePropertyId, laundryConfig, refreshLaundryConfig } = useProperty();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [localConfig, setLocalConfig] = useState<LaundryCategory[]>([]);

  const config = localConfig.length > 0 ? localConfig : laundryConfig;

  const upd = (id: string, field: keyof LaundryCategory, value: number | string) => {
    setLocalConfig(c =>
      c.length > 0
        ? c.map(cat => cat.id === id ? { ...cat, [field]: value } : cat)
        : laundryConfig.map(cat => cat.id === id ? { ...cat, [field]: value } : cat)
    );
  };

  const handleSave = async (cat: LaundryCategory) => {
    if (!user || !activePropertyId) return;
    setSaving(cat.id);
    try {
      await setLaundryCategory(user.uid, activePropertyId, cat);
      await refreshLaundryConfig();
      setSaved(cat.id);
      setTimeout(() => setSaved(null), 2000);
    } finally {
      setSaving(null);
    }
  };

  return (
    <AppLayout>
      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Link href="/settings" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px' }}>← Settings</Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} color="var(--amber)" /> Laundry Settings
          </h1>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
          Configure how laundry loads are calculated. Each category has units per checkout room, a multiplier for 2-bed rooms, a stayover factor, room-equivalents per load, and minutes per load.
        </p>

        {config.map(cat => (
          <div key={cat.id} className="card" style={{ padding: '20px', marginBottom: '12px' }}>
            <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '16px' }}>
              {cat.name}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              {[
                { label: 'Units per 1-Bed Checkout', field: 'unitsPerCheckout' as keyof LaundryCategory },
                { label: '2-Bed Multiplier', field: 'twoBedMultiplier' as keyof LaundryCategory },
                { label: 'Stayover Factor (0–1)', field: 'stayoverFactor' as keyof LaundryCategory },
                { label: 'Room-Equivs per Load', field: 'roomEquivsPerLoad' as keyof LaundryCategory },
                { label: 'Minutes per Load', field: 'minutesPerLoad' as keyof LaundryCategory },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="label">{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cat[field] as number}
                    onChange={e => upd(cat.id, field, parseFloat(e.target.value) || 0)}
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSave(cat)}
              disabled={saving === cat.id || saved === cat.id}
              className={`btn btn-sm ${saved === cat.id ? 'btn-green' : 'btn-primary'}`}
            >
              {saved === cat.id ? <><Check size={14} /> Saved</> : saving === cat.id ? 'Saving...' : 'Save'}
            </button>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}

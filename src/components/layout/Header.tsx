'use client';

import React from 'react';
import { useProperty } from '@/contexts/PropertyContext';
import { useLang } from '@/contexts/LanguageContext';
import { Bell } from 'lucide-react';

export function Header() {
  const { activeProperty } = useProperty();
  const { lang } = useLang();

  // Get page title from path
  const getPageTitle = () => {
    if (typeof window === 'undefined') return '';
    const path = window.location.pathname;
    if (path.includes('housekeeping')) return lang === 'es' ? 'Limpieza' : 'Housekeeping';
    if (path.includes('maintenance')) return lang === 'es' ? 'Mantenimiento' : 'Maintenance';
    if (path.includes('inventory')) return lang === 'es' ? 'Inventario' : 'Inventory';
    if (path.includes('staff')) return lang === 'es' ? 'Personal' : 'Staff';
    if (path.includes('settings')) return lang === 'es' ? 'Configuración' : 'Settings';
    return '';
  };

  const title = getPageTitle();

  return (
    <header style={{
      padding: '0 32px', height: '52px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid rgba(78, 90, 122, 0.06)',
      background: 'transparent',
      flexShrink: 0,
    }}>
      {/* Left: breadcrumb-style page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {title && (
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px',
            fontWeight: 500, color: 'var(--on-surface-variant)',
            letterSpacing: '0.01em',
          }}>
            {title}
          </span>
        )}
      </div>

      {/* Right: notifications */}
      <button
        style={{
          padding: '6px', borderRadius: '8px', border: 'none',
          background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => {}}
      >
        <Bell size={18} color="var(--on-surface-variant)" strokeWidth={1.6} />
      </button>
    </header>
  );
}

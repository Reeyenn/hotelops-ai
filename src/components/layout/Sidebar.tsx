'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/contexts/LanguageContext';
import {
  LayoutDashboard, BedDouble, Wrench, Package, Users,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { lang } = useLang();

  const navLinks = [
    { href: '/dashboard',    label: lang === 'es' ? 'Panel' : 'Dashboard',       icon: LayoutDashboard },
    { href: '/housekeeping', label: lang === 'es' ? 'Limpieza' : 'Housekeeping',  icon: BedDouble },
    { href: '/maintenance',  label: lang === 'es' ? 'Mantenimiento' : 'Maintenance', icon: Wrench },
    { href: '/inventory',    label: lang === 'es' ? 'Inventario' : 'Inventory',   icon: Package },
    { href: '/staff',        label: lang === 'es' ? 'Personal' : 'Staff',         icon: Users },
  ];

  return (
    <aside style={{
      width: '240px',
      minHeight: '100%',
      background: 'rgba(251, 249, 244, 0.85)',
      backdropFilter: 'blur(64px)',
      WebkitBackdropFilter: 'blur(64px)',
      borderRight: '1px solid rgba(78, 90, 122, 0.10)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 12px',
      gap: '4px',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 12px 24px', marginBottom: '4px' }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 700,
          fontSize: '22px', color: '#364262', letterSpacing: '-0.02em',
        }}>
          Staxis
        </span>
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navLinks.map(link => {
          const isActive = pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 14px', borderRadius: '10px',
                fontFamily: 'var(--font-sans)', fontWeight: isActive ? 600 : 450,
                fontSize: '15px', letterSpacing: '-0.01em',
                color: isActive ? '#006565' : '#454652',
                background: isActive ? 'rgba(0, 101, 101, 0.08)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

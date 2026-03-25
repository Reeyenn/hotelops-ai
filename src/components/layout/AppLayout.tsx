'use client';

import React, { useEffect, useState } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { WifiOff } from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Header />

      {/* ── Offline banner ── */}
      {!isOnline && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.3)',
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <WifiOff size={14} color="#EF4444" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#EF4444' }}>
            You&apos;re offline — changes will sync when reconnected
          </span>
        </div>
      )}

      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        /* bottom padding = nav 64px + safe area + 8px breathing room */
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      }}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

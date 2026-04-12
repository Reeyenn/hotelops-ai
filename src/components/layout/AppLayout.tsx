'use client';

import React, { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useLang } from '@/contexts/LanguageContext';
import { useSyncContext } from '@/contexts/SyncContext';
import { t } from '@/lib/translations';
import { WifiOff, RefreshCw } from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  const { isOnline, pendingCount, isSyncing } = useSyncContext();

  const showOffline  = !isOnline;
  const showSyncing  = isOnline && isSyncing;
  const showBanner   = showOffline || showSyncing;

  const offlineLabel = pendingCount > 0
    ? `Offline - ${pendingCount} ${t('changesQueued', lang)}`
    : t('offline', lang);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js', { scope: '/' })
        .catch((err) => console.warn('SW registration failed:', err));
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      {/* Left sidebar — dark, full height */}
      <Sidebar />

      {/* Right: content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header />

        {/* Status banner */}
        {showBanner && (
          <div style={{
            borderBottom: '1px solid ' + (showSyncing ? 'var(--amber-border, rgba(251,191,36,0.3))' : 'var(--red-border, rgba(239,68,68,0.3))'),
            background: showSyncing ? 'var(--amber-dim)' : 'var(--red-dim)',
            padding: '8px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            {showSyncing ? (
              <>
                <RefreshCw size={14} color="var(--amber)" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--amber)' }}>
                  {t('syncingChanges', lang)}
                </span>
              </>
            ) : (
              <>
                <WifiOff size={14} color="var(--red)" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red)' }}>
                  {offlineLabel}
                </span>
              </>
            )}
          </div>
        )}

        <main style={{ flex: 1, width: '100%' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

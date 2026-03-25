'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { registerForPushNotifications } from '@/lib/notifications';
import { BedDouble, Bell, CheckCircle, AlertCircle } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  isSenior: boolean;
}

type Step = 'loading' | 'select' | 'requesting' | 'done' | 'denied' | 'error' | 'bad-link';

export default function HousekeeperPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', color:'var(--text-muted)', fontFamily:'var(--font-sans)' }}>Loading…</div>}>
      <HousekeeperInner />
    </Suspense>
  );
}

function HousekeeperInner() {
  const params = useSearchParams();
  const uid = params.get('uid');
  const pid = params.get('pid');

  const [staff,      setStaff]      = useState<StaffMember[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [step,       setStep]       = useState<Step>('loading');
  const [errorMsg,   setErrorMsg]   = useState('');

  useEffect(() => {
    if (!uid || !pid) { setStep('bad-link'); return; }

    fetch(`/api/staff-list?uid=${uid}&pid=${pid}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          setStep('error');
          setErrorMsg('No staff scheduled today. Ask your manager to add you to today\'s schedule.');
        } else {
          setStaff(data);
          setStep('select');
        }
      })
      .catch(() => {
        setStep('error');
        setErrorMsg('Could not load staff list. Check your connection and try again.');
      });
  }, [uid, pid]);

  const handleSetup = async () => {
    if (!uid || !pid || !selectedId) return;
    setStep('requesting');

    const token = await registerForPushNotifications();

    if (!token) {
      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      if (permission === 'denied') {
        setStep('denied');
      } else {
        setStep('error');
        setErrorMsg('Could not enable notifications. On iPhone, you must add this page to your Home Screen first, then open it from there.');
      }
      return;
    }

    // Save token via API
    try {
      await fetch('/api/save-fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, pid, staffId: selectedId, token }),
      });
      setStep('done');
    } catch {
      setStep('error');
      setErrorMsg('Registered but could not save. Check your connection.');
    }
  };

  const selectedName = staff.find(s => s.id === selectedId)?.name ?? '';

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'var(--font-sans)',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
        }}>
          <BedDouble size={28} color="var(--amber)" />
        </div>
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          HotelOps AI
        </p>
      </div>

      {/* Loading */}
      {step === 'loading' && (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
      )}

      {/* Bad link */}
      {step === 'bad-link' && (
        <div style={{ textAlign: 'center', maxWidth: '320px' }}>
          <AlertCircle size={40} color="#EF4444" style={{ marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            This link is missing information. Ask your manager to resend the correct link.
          </p>
        </div>
      )}

      {/* Select name */}
      {step === 'select' && (
        <div style={{
          width: '100%', maxWidth: '360px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '24px',
        }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            Set up notifications
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
            Select your name so we can send your room assignments to this phone.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {staff.map(member => (
              <button key={member.id} onClick={() => setSelectedId(member.id)} style={{
                padding: '14px 16px',
                background: selectedId === member.id ? 'var(--amber-dim)' : 'var(--bg)',
                border: `1.5px solid ${selectedId === member.id ? 'var(--amber-border)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer',
                transition: 'all 120ms', fontFamily: 'var(--font-sans)',
              }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: selectedId === member.id ? 'var(--amber)' : 'var(--text-primary)' }}>
                  {member.name}{member.isSenior ? ' ⭐' : ''}
                </span>
              </button>
            ))}
          </div>

          <button onClick={handleSetup} disabled={!selectedId} style={{
            width: '100%', height: '48px',
            background: selectedId ? 'var(--amber)' : 'var(--border)',
            color: selectedId ? '#0A0A0A' : 'var(--text-muted)',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px',
            cursor: selectedId ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 120ms',
          }}>
            <Bell size={18} /> Enable Notifications
          </button>
        </div>
      )}

      {/* Requesting */}
      {step === 'requesting' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Setting up…</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Tap "Allow" when your browser asks.</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div style={{
          width: '100%', maxWidth: '360px', textAlign: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '32px 24px',
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <CheckCircle size={30} color="var(--green)" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            You&apos;re all set, {selectedName.split(' ')[0]}!
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            When your manager assigns rooms, you&apos;ll get a notification on this phone — even if the app is closed.
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>You can close this page.</p>
        </div>
      )}

      {/* Denied */}
      {step === 'denied' && (
        <div style={{
          width: '100%', maxWidth: '360px', textAlign: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '32px 24px',
        }}>
          <AlertCircle size={40} color="var(--amber)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Notifications blocked</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Go to your browser settings, find this site, and allow notifications. Then come back and try again.
          </p>
          <button onClick={() => setStep('select')} style={{
            marginTop: '20px', padding: '10px 24px',
            background: 'var(--amber)', color: '#0A0A0A', border: 'none',
            borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', fontWeight: 600, cursor: 'pointer',
          }}>Try again</button>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div style={{
          width: '100%', maxWidth: '360px', textAlign: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '32px 24px',
        }}>
          <AlertCircle size={40} color="#EF4444" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{errorMsg}</p>
          <button onClick={() => { setStep('loading'); }} style={{
            marginTop: '20px', padding: '10px 24px',
            background: 'var(--amber)', color: '#0A0A0A', border: 'none',
            borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', fontWeight: 600, cursor: 'pointer',
          }}>Try again</button>
        </div>
      )}
    </div>
  );
}

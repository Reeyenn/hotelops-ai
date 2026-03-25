'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProperty } from '@/contexts/PropertyContext';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  subscribeToHandoffLogs,
  addHandoffEntry,
  acknowledgeHandoffEntry,
} from '@/lib/firestore';
import type { HandoffEntry } from '@/types';
import { BookOpen, Sun, Cloud, Moon, Plus, CheckCircle2, AlertCircle, NotebookIcon } from 'lucide-react';
import { format, isToday, differenceInHours } from 'date-fns';

// ─── Shift type config ────────────────────────────────────────────────────────

const SHIFT_CONFIG = {
  morning: {
    label: 'Morning',
    icon: Sun,
    badgeColor: '#FBBF24',
    badgeBg: 'rgba(251,191,36,0.12)',
    badgeBorder: 'rgba(251,191,36,0.35)',
  },
  afternoon: {
    label: 'Afternoon',
    icon: Cloud,
    badgeColor: '#3B82F6',
    badgeBg: 'rgba(59,130,246,0.12)',
    badgeBorder: 'rgba(59,130,246,0.35)',
  },
  night: {
    label: 'Night',
    icon: Moon,
    badgeColor: '#8B5CF6',
    badgeBg: 'rgba(139,92,246,0.12)',
    badgeBorder: 'rgba(139,92,246,0.35)',
  },
};

// ─── Helper: convert Firestore timestamp ─────────────────────────────────────

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as any).toDate === 'function') return (v as any).toDate();
  return new Date(v as string);
}

// ─── Helper: format timestamp for display ────────────────────────────────────

function formatTime(date: Date | null): string {
  if (!date) return '';
  if (isToday(date)) return `Today ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d \'at\' h:mm a');
}

// ─── Stats Row Component ─────────────────────────────────────────────────────

function StatsRow({
  totalCount,
  unreadCount,
  todayCount,
}: {
  totalCount: number;
  unreadCount: number;
  todayCount: number;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 500 }}>
          Total Entries
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{totalCount}</div>
      </div>

      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 500 }}>
          Unread (24h)
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--amber)' }}>{unreadCount}</div>
      </div>

      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 500 }}>
          Today
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--green)' }}>{todayCount}</div>
      </div>
    </div>
  );
}

// ─── Add Entry Form Component ────────────────────────────────────────────────

interface AddEntryFormProps {
  onSubmit: (entry: Omit<HandoffEntry, 'id' | 'createdAt'>) => Promise<void>;
  isLoading: boolean;
}

function AddEntryForm({ onSubmit, isLoading }: AddEntryFormProps) {
  const [author, setAuthor] = useState('');
  const [shiftType, setShiftType] = useState<'morning' | 'afternoon' | 'night'>('morning');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !notes.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        shiftType,
        author: author.trim(),
        notes: notes.trim(),
        propertyId: '', // will be set by parent
        acknowledged: false,
      });
      setAuthor('');
      setNotes('');
      setShiftType('morning');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '32px',
      }}
    >
      <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Add New Entry</h3>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Author field */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' }}>
            Your Name *
          </label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        {/* Shift type selector */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Shift Type *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {Object.entries(SHIFT_CONFIG).map(([type, cfg]) => (
              <button
                key={type}
                type="button"
                onClick={() => setShiftType(type as 'morning' | 'afternoon' | 'night')}
                style={{
                  padding: '10px',
                  background: shiftType === type ? cfg.badgeBg : 'transparent',
                  border: `1px solid ${shiftType === type ? cfg.badgeBorder : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: shiftType === type ? cfg.badgeColor : 'var(--text-secondary)',
                  fontWeight: shiftType === type ? 600 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes textarea */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' }}>
            Notes *
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What does the next shift need to know?"
            required
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting || !author.trim() || !notes.trim()}
          style={{
            padding: '10px 16px',
            background: author.trim() && notes.trim() ? 'var(--green)' : 'var(--text-muted)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: author.trim() && notes.trim() ? 'pointer' : 'not-allowed',
            opacity: isSubmitting ? 0.7 : 1,
            transition: 'all 0.2s ease',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {isSubmitting ? 'Posting...' : 'Post Note'}
        </button>
      </form>
    </div>
  );
}

// ─── Entry Card Component ────────────────────────────────────────────────────

interface EntryCardProps {
  entry: HandoffEntry;
  onAcknowledge: (entryId: string, byName: string) => Promise<void>;
  isLoading: boolean;
}

function EntryCard({ entry, onAcknowledge, isLoading }: EntryCardProps) {
  const [acknowledgeMode, setAcknowledgeMode] = useState(false);
  const [acknowledgedByName, setAcknowledgedByName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shiftCfg = SHIFT_CONFIG[entry.shiftType];
  const ShiftIcon = shiftCfg.icon;
  const createdAt = toDate(entry.createdAt);
  const acknowledgedAt = toDate(entry.acknowledgedAt);

  const handleAcknowledge = async () => {
    if (!acknowledgedByName.trim()) return;
    setIsSubmitting(true);
    try {
      await onAcknowledge(entry.id, acknowledgedByName.trim());
      setAcknowledgeMode(false);
      setAcknowledgedByName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-card)',
        border: `1px solid ${!entry.acknowledged ? 'var(--amber-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        marginBottom: '12px',
      }}
    >
      {/* Header: shift badge + author + timestamp */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Shift badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: shiftCfg.badgeBg,
              border: `1px solid ${shiftCfg.badgeBorder}`,
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 600,
              color: shiftCfg.badgeColor,
            }}
          >
            <ShiftIcon size={14} />
            {shiftCfg.label}
          </div>

          {/* Author */}
          <div>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>{entry.author}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>
              {createdAt ? formatTime(createdAt) : 'Unknown time'}
            </span>
          </div>
        </div>

        {/* Unread badge */}
        {!entry.acknowledged && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: 'var(--amber-dim)',
              border: `1px solid var(--amber-border)`,
              borderRadius: 'var(--radius-md)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--amber)',
            }}
          >
            <AlertCircle size={12} />
            Unread
          </div>
        )}
      </div>

      {/* Notes text */}
      <div
        style={{
          padding: '12px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '12px',
          fontSize: '14px',
          lineHeight: '1.5',
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        }}
      >
        {entry.notes}
      </div>

      {/* Acknowledgement section */}
      {!entry.acknowledged ? (
        <div>
          {!acknowledgeMode ? (
            <button
              onClick={() => setAcknowledgeMode(true)}
              style={{
                padding: '8px 12px',
                background: 'var(--amber-dim)',
                border: `1px solid var(--amber-border)`,
                color: 'var(--amber)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Mark as Read
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={acknowledgedByName}
                onChange={(e) => setAcknowledgedByName(e.target.value)}
                placeholder="Your name"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: '12px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                }}
              />
              <button
                onClick={handleAcknowledge}
                disabled={!acknowledgedByName.trim() || isSubmitting}
                style={{
                  padding: '8px 12px',
                  background: acknowledgedByName.trim() ? 'var(--green)' : 'var(--text-muted)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: acknowledgedByName.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {isSubmitting ? 'Confirming...' : 'Confirm'}
              </button>
              <button
                onClick={() => {
                  setAcknowledgeMode(false);
                  setAcknowledgedByName('');
                }}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--green)', fontSize: '12px' }}>
          <CheckCircle2 size={16} />
          <span>
            Read by <span style={{ fontWeight: 600 }}>{entry.acknowledgedBy}</span>
            {acknowledgedAt && <span style={{ color: 'var(--text-muted)' }}> at {format(acknowledgedAt, 'h:mm a')}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function LogbookPage() {
  const { user } = useAuth();
  const { activePropertyId } = useProperty();
  const [entries, setEntries] = useState<HandoffEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to handoff logs
  useEffect(() => {
    if (!user?.uid || !activePropertyId) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = subscribeToHandoffLogs(user.uid, activePropertyId, (data) => {
      setEntries(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, activePropertyId]);

  // Calculate stats
  const totalCount = entries.length;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const unreadCount = entries.filter((e) => {
    if (e.acknowledged) return false;
    const createdAt = toDate(e.createdAt);
    return createdAt && createdAt > twentyFourHoursAgo;
  }).length;

  const todayCount = entries.filter((e) => {
    const createdAt = toDate(e.createdAt);
    return createdAt && isToday(createdAt);
  }).length;

  // Handlers
  const handleAddEntry = async (entry: Omit<HandoffEntry, 'id' | 'createdAt' | 'acknowledged' | 'acknowledgedBy' | 'acknowledgedAt'>) => {
    if (!user?.uid || !activePropertyId) return;
    try {
      await addHandoffEntry(user.uid, activePropertyId, {
        ...entry,
        propertyId: activePropertyId,
        acknowledged: false,
      });
    } catch (err) {
      console.error('Failed to add entry:', err);
    }
  };

  const handleAcknowledge = async (entryId: string, byName: string) => {
    if (!user?.uid || !activePropertyId) return;
    try {
      await acknowledgeHandoffEntry(user.uid, activePropertyId, entryId, byName);
    } catch (err) {
      console.error('Failed to acknowledge entry:', err);
    }
  };

  // Display logic
  const displayEntries = entries.slice(0, 30);
  const isEmpty = displayEntries.length === 0;

  return (
    <AppLayout>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <BookOpen size={28} style={{ color: 'var(--green)' }} />
              <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Shift Logbook</h1>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>Shift-to-shift handoff notes</p>
          </div>
        </div>

        {/* Stats Row */}
        <StatsRow totalCount={totalCount} unreadCount={unreadCount} todayCount={todayCount} />

        {/* Add Entry Form */}
        {user?.uid && activePropertyId && <AddEntryForm onSubmit={handleAddEntry} isLoading={isLoading} />}

        {/* Entries List or Empty State */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>Loading logbook...</div>
          </div>
        ) : isEmpty ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <NotebookIcon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>No logbook entries yet.</p>
            <p style={{ fontSize: '14px' }}>Be the first to post a shift note.</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase' }}>
              {displayEntries.length} Entries (Newest First)
            </div>
            {displayEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onAcknowledge={handleAcknowledge}
                isLoading={isLoading}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

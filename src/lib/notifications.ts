import { getMessaging, getToken } from 'firebase/messaging';
import app from './firebase';

/**
 * Requests notification permission and returns an FCM token.
 * Call this on the housekeeper's phone after they select their name.
 * Returns null if permission was denied or any error occurred.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Must be in a browser that supports notifications
    if (typeof window === 'undefined' || !('Notification' in window)) return null;
    if (!('serviceWorker' in navigator)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error('NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set');
      return null;
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey });
    return token || null;
  } catch (err) {
    console.error('Push registration failed:', err);
    return null;
  }
}

/**
 * Sends SMS room assignment notifications via Twilio.
 * Called alongside sendAssignmentNotifications after Smart Assign.
 */
export async function sendSmsNotifications(
  assignments: Record<string, string[]>,   // staffId → room numbers[]
  staffNames:  Record<string, string>,     // staffId → name
  staffPhones: Record<string, string>,     // staffId → phone number
): Promise<{ sent: number; failed: number }> {
  const entries = Object.entries(assignments).filter(([staffId]) => staffPhones[staffId]);
  if (entries.length === 0) return { sent: 0, failed: 0 };

  const res = await fetch('/api/notify-housekeepers-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      entries.map(([staffId, rooms]) => ({
        phone:          staffPhones[staffId],
        name:           staffNames[staffId] ?? 'Housekeeper',
        rooms,
        housekeeperId:  staffId,
      }))
    ),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`notify-housekeepers-sms HTTP ${res.status}:`, text);
    return { sent: 0, failed: entries.length };
  }

  return res.json() as Promise<{ sent: number; failed: number }>;
}

/**
 * Sends room assignment notifications to all assigned housekeepers.
 * Called by the GM after Smart Assign runs.
 *
 * assignments: map of staffId → array of room numbers they were assigned
 * staffTokens: map of staffId → FCM token (pull from staff records)
 */
export async function sendAssignmentNotifications(
  assignments: Record<string, string[]>,   // staffId → room numbers[]
  staffNames: Record<string, string>,       // staffId → name
  staffTokens: Record<string, string>,      // staffId → fcmToken
): Promise<void> {
  const entries = Object.entries(assignments).filter(([staffId]) => staffTokens[staffId]);
  if (entries.length === 0) return;

  await fetch('/api/notify-housekeepers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      entries.map(([staffId, rooms]) => ({
        token: staffTokens[staffId],
        name: staffNames[staffId] ?? 'Housekeeper',
        rooms,
      }))
    ),
  });
}

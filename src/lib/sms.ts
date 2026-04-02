/**
 * Shared SMS utility — Twilio REST API (no SDK dependency)
 *
 * Reads credentials from env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER   (E.164, e.g. +12816669887)
 */

export async function sendSms(to: string, message: string): Promise<void> {
  const key = process.env.TEXTBELT_API_KEY ?? 'textbelt';

  const res = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: to, message, key }),
  });

  const data = await res.json() as { success: boolean; error?: string };
  if (!data.success) throw new Error(data.error ?? 'Textbelt send failed');
}

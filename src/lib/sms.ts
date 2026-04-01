/**
 * Shared SMS utility — Twilio REST API (no SDK dependency)
 *
 * Reads credentials from env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER   (E.164, e.g. +12816669887)
 */

export async function sendSms(to: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error('Missing Twilio env vars (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)');
  }

  console.log(`[sms] sending to=${to} from=${from} accountSid=${accountSid?.slice(0,8)}...`);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
    },
  );

  const responseBody = await res.json() as { sid?: string; status?: string; message?: string; code?: number };
  console.log(`[sms] Twilio response status=${res.status} sid=${responseBody.sid} msgStatus=${responseBody.status} error=${responseBody.message ?? 'none'}`);

  if (!res.ok) {
    throw new Error(`Twilio error ${responseBody.code ?? res.status}: ${responseBody.message ?? 'send failed'}`);
  }
}

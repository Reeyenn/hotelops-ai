import { NextRequest, NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  const { uid, pid, staffId, token } = await req.json();
  if (!uid || !pid || !staffId || !token) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  await admin.firestore()
    .collection('users').doc(uid)
    .collection('properties').doc(pid)
    .collection('staff').doc(staffId)
    .update({ fcmToken: token });

  return NextResponse.json({ ok: true });
}

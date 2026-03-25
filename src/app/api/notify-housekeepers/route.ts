import { NextRequest, NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

interface NotifyEntry {
  token: string;     // FCM device token
  name: string;      // housekeeper's name (for the message)
  rooms: string[];   // room numbers assigned to them
}

export async function POST(req: NextRequest) {
  try {
    const entries: NotifyEntry[] = await req.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'No entries provided' }, { status: 400 });
    }

    const messaging = admin.messaging();

    const results = await Promise.allSettled(
      entries.map(({ token, name, rooms }) => {
        const roomList = rooms.length <= 4
          ? rooms.join(', ')
          : `${rooms.slice(0, 3).join(', ')} +${rooms.length - 3} more`;

        return messaging.send({
          token,
          notification: {
            title: `Your rooms are ready, ${name.split(' ')[0]}`,
            body: `Assigned: ${roomList}`,
          },
          data: {
            rooms: rooms.join(','),
          },
          webpush: {
            notification: {
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'room-assignment',
              renotify: true,
            },
            fcmOptions: {
              link: '/rooms',
            },
          },
        });
      })
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Log any failures for debugging
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Failed to notify ${entries[i].name}:`, r.reason);
      }
    });

    return NextResponse.json({ sent, failed });
  } catch (err) {
    console.error('notify-housekeepers error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

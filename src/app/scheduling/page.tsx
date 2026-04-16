// This page has been removed. Scheduling is now under Housekeeping → Schedule tab.
// Keeping file to prevent 404 — redirects to /housekeeping.
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function SchedulingRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/housekeeping'); }, [router]);
  return null;
}

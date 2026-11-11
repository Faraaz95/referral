'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';

export default function Logout() {
  const [done, setDone] = useState(false);
  useEffect(() => { api('auth/logout/', { method: 'POST' }).finally(() => setDone(true)); }, []);
  return (
    <>
      <div className="auth-icon"><Icon name="logout" /></div>
      <h1>{done ? 'You’re signed out' : 'Signing out…'}</h1>
      <p className="sub">Thanks for stopping by. See you soon.</p>
      <Link className="btn primary block" href="/login">Sign in again</Link>
    </>
  );
}

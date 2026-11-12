'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('auth/login/', { body: { username, password, remember } });
      router.replace(next.startsWith('/') ? next : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Welcome back</h1>
      <p className="sub">Sign in to your partner dashboard.</p>
      {/* Explicit tab order: Forgot password comes after Sign in, though it sits beside the Password label */}
      <form className="auth-form" onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div><label htmlFor="u">Email or username</label>
          <input id="u" tabIndex={1} autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        <div><div className="label-row"><label htmlFor="p">Password</label><Link className="link" href="/forgot-password" tabIndex={5}>Forgot password?</Link></div>
          <input id="p" tabIndex={2} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <label className="check"><input type="checkbox" tabIndex={3} checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in</label>
        <button className="btn primary block" tabIndex={4} type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

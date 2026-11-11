'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await api('auth/password/reset/', { body: { email } }); } finally { setSent(true); setBusy(false); }
  };

  if (sent) return (
    <>
      <div className="auth-icon"><Icon name="mail" /></div>
      <h1>Check your email</h1>
      <p className="sub">If an account exists for {email}, a reset link is on its way. It expires in 3 days.</p>
      <p className="auth-alt">Didn’t get it? <button className="link" type="button" onClick={() => setSent(false)}>Send again</button></p>
      <p className="auth-alt"><Link className="link" href="/login">← Back to sign in</Link></p>
    </>
  );

  return (
    <>
      <h1>Reset your password</h1>
      <p className="sub">Enter your email and we’ll send you a link to set a new password.</p>
      <form className="auth-form" onSubmit={submit}>
        <div><label htmlFor="e">Email</label><input id="e" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></div>
        <button className="btn primary block" type="submit" disabled={busy}>Send reset link</button>
      </form>
      <p className="auth-alt"><Link className="link" href="/login">← Back to sign in</Link></p>
    </>
  );
}

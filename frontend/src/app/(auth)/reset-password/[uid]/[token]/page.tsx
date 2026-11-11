'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

export default function ResetPassword() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({}); setMessage('');
    try {
      await api('auth/password/reset/confirm/', { body: { uid, token, new_password: pw, confirm_password: pw2 } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.fields); setMessage(err.fields.new_password || err.fields.confirm_password ? '' : err.message); }
    }
  };

  if (done) return (
    <>
      <h1>Password updated</h1>
      <p className="sub">You can now sign in with your new password.</p>
      <Link className="btn primary block" href="/login">Sign in</Link>
    </>
  );

  return (
    <>
      <h1>Set a new password</h1>
      <p className="sub">Choose a password you don’t use anywhere else.</p>
      <form className="auth-form" onSubmit={submit}>
        {message && <p className="form-error" role="alert">{message}</p>}
        <div><label htmlFor="n">New password</label><input id="n" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
          {errors.new_password && <small className="field-error">{errors.new_password.join(' ')}</small>}</div>
        <div><label htmlFor="c">Confirm new password</label><input id="c" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {errors.confirm_password && <small className="field-error">{errors.confirm_password.join(' ')}</small>}</div>
        <ul className="rules"><li>At least 8 characters</li><li>Not only numbers, not too common</li><li>Not similar to your username or email</li></ul>
        <button className="btn primary block" type="submit">Set new password</button>
      </form>
    </>
  );
}

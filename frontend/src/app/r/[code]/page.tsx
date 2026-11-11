'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

interface Info { program: string; code: string; partner: string; company: string }

export default function PublicReferral() {
  const { code } = useParams<{ code: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [f, setF] = useState({ client_name: '', client_email: '', client_phone: '', company: '', project: '', description: '', estimated_value: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { api<Info>(`public/r/${encodeURIComponent(code)}/`).then(setInfo).catch(() => setInvalid(true)); }, [code]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(''); setErrors({});
    try { await api(`public/r/${encodeURIComponent(code)}/`, { body: f }); setDone(true); }
    catch (e2) { if (e2 instanceof ApiError) { setErrors(e2.fields); setErr(e2.message); } setBusy(false); }
  };
  const initials = info?.partner.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="public">
      <div className="public-wrap">
        <div className="public-head">
          <Logo href="/" />
          {info && <span className="ref-badge"><span className="av">{initials}</span>Referred by <b>{info.partner}</b>{info.company ? ` · ${info.company}` : ''}</span>}
        </div>
        {invalid ? (
          <div className="card done-card"><h1>This referral link isn’t valid</h1><p className="sub">Please check the link or ask the person who shared it.</p></div>
        ) : done ? (
          <div className="card done-card"><div className="auth-icon"><Icon name="check" /></div><h1>Thanks — we got it!</h1><p className="sub">Our team will contact you shortly about your project.</p></div>
        ) : (
          <div className="public-grid">
            <div className="public-intro">
              <h1>Let’s build your next project.</h1>
              <p>{info ? <><b>{info.partner}</b> thinks we’d be a great fit for you. Tell us a little about what you need and we’ll get back to you within one business day.</> : 'Loading…'}</p>
              {info && <p className="small">Referral code <b>{info.code}</b> is applied automatically.</p>}
            </div>
            <form className="card" onSubmit={submit}>
              {err && <p className="form-error">{err}</p>}
              <div className="form-grid">
                <Field label="Your name" error={errors.client_name}><input required value={f.client_name} onChange={set('client_name')} /></Field>
                <Field label="Company" error={errors.company}><input value={f.company} onChange={set('company')} /></Field>
                <Field label="Email" error={errors.client_email}><input required type="email" value={f.client_email} onChange={set('client_email')} /></Field>
                <Field label="Phone" error={errors.client_phone}><input value={f.client_phone} onChange={set('client_phone')} /></Field>
                <Field label="What do you need?" error={errors.project} full><input value={f.project} onChange={set('project')} placeholder="Website, app, CRM, automation…" /></Field>
                <Field label="Tell us more" error={errors.description} full><textarea value={f.description} onChange={set('description')} /></Field>
                <Field label="Approximate budget (optional)" error={errors.estimated_value} full><input type="number" min="0" value={f.estimated_value} onChange={set('estimated_value')} /></Field>
              </div>
              <div className="form-foot"><button className="btn primary block" disabled={busy || !info} type="submit">{busy ? 'Sending…' : 'Send project request'}</button></div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

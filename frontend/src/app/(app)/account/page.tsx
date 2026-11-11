'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import { CopyField } from '@/components/kit';
import { CardHead, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { rateLabel, referralLink } from '@/lib/format';
import type { Me } from '@/lib/types';

export default function Account() {
  const { me, setMe, options, notify } = useApp();
  const [f, setF] = useState({ first_name: me.first_name, last_name: me.last_name, email: me.email, company: me.profile.company, phone: me.profile.phone, website: me.profile.website, payout_method: me.profile.payout_method, payout_details: me.profile.payout_details });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pwErrors, setPwErrors] = useState<Record<string, string[]>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { first_name, last_name, email, ...profile } = f;
    try { setMe(await api<Me>('auth/me/', { method: 'PATCH', body: { first_name, last_name, email, profile } })); setErrors({}); notify('Profile saved'); }
    catch (e2) { if (e2 instanceof ApiError) { setErrors({ ...e2.fields, ...((e2.fields.profile as unknown as Record<string, string[]>) ?? {}) }); notify(e2.message, 'error'); } }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('auth/password/change/', { body: pw }); setPw({ current_password: '', new_password: '', confirm_password: '' }); setPwErrors({}); notify('Password changed'); }
    catch (e2) { if (e2 instanceof ApiError) setPwErrors(e2.fields); }
  };

  return (
    <>
      <div className="top"><div><h1>Account</h1><p className="sub">Your profile, payout details and password.</p></div></div>
      <div className="panes">
        <form className="card pane" onSubmit={save}>
          <CardHead icon="leads" title="Profile" />
          <div className="form-grid">
            <Field label="First name" error={errors.first_name}><input value={f.first_name} onChange={set('first_name')} /></Field>
            <Field label="Last name" error={errors.last_name}><input value={f.last_name} onChange={set('last_name')} /></Field>
            <Field label="Email" error={errors.email} full><input type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Company" error={errors.company}><input value={f.company} onChange={set('company')} /></Field>
            <Field label="Phone" error={errors.phone}><input value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Website" error={errors.website} full><input value={f.website} onChange={set('website')} /></Field>
          </div>
          {!me.is_admin && <>
            <hr className="sep" />
            <p className="pane-title">Payout details</p>
            <div className="form-grid">
              <Field label="Method" error={errors.payout_method}><select value={f.payout_method} onChange={set('payout_method')}>{options.payout_methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
              <Field label="Pay to" error={errors.payout_details} full><textarea value={f.payout_details} onChange={set('payout_details')} placeholder="Account holder, IBAN / SWIFT, or PayPal email" /></Field>
            </div>
          </>}
          <div className="form-foot"><button className="btn primary" type="submit">Save profile</button></div>
        </form>
        <div className="side-cards">
          {me.profile.code && (
            <div className="card">
              <CardHead icon="share" title="Your referral code" sub={rateLabel(me.profile.group, me.profile.custom_rate)} />
              <div className="code-big" style={{ fontSize: 30, margin: '0 0 14px' }}>{me.profile.code}</div>
              <CopyField light value={referralLink(me.profile.code)} label="Copy link" />
            </div>
          )}
          <form className="card pane" onSubmit={changePw}>
            <CardHead icon="lock" title="Password" />
            <div className="form-grid one">
              <Field label="Current password" error={pwErrors.current_password}><input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></Field>
              <Field label="New password" error={pwErrors.new_password}><input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required /></Field>
              <Field label="Repeat new password" error={pwErrors.confirm_password}><input type="password" autoComplete="new-password" value={pw.confirm_password} onChange={(e) => setPw({ ...pw, confirm_password: e.target.value })} required /></Field>
            </div>
            <div className="form-foot"><button className="btn primary" type="submit">Change password</button></div>
          </form>
          {options.settings.terms && <div className="card"><CardHead icon="info" title="Program terms" /><p className="pre small" style={{ margin: 0 }}>{options.settings.terms}</p></div>}
        </div>
      </div>
    </>
  );
}

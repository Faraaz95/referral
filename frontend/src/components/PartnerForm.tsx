'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Partner } from '@/lib/types';
import { useApp } from './AppShell';
import { Field } from './ui';

export function PartnerForm({ initial, onSaved, onCancel }: { initial?: Partner; onSaved: (p: Partner) => void; onCancel: () => void }) {
  const { options, reloadOptions } = useApp();
  const [f, setF] = useState({
    first_name: initial?.first_name ?? '', last_name: initial?.last_name ?? '', email: initial?.email ?? '', username: initial?.username ?? '',
    password: '', role: initial?.role ?? 'partner', code: initial?.code ?? '', group_id: initial?.group_id != null ? String(initial.group_id) : '',
    custom_rate: initial?.custom_rate ?? '', company: initial?.company ?? '', phone: initial?.phone ?? '', website: initial?.website ?? '',
    payout_method: initial?.payout_method ?? 'bank', payout_details: initial?.payout_details ?? '', notes: initial?.notes ?? '',
    is_active: initial?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(''); setErrors({});
    const body: Record<string, unknown> = { ...f, group_id: f.group_id ? Number(f.group_id) : null, custom_rate: f.custom_rate === '' ? null : f.custom_rate, code: f.code || null };
    if (!body.password) delete body.password;
    if (!body.username) delete body.username;
    try {
      const p = await api<Partner>(initial ? `partners/${initial.id}/` : 'partners/', { method: initial ? 'PATCH' : 'POST', body });
      await reloadOptions();
      onSaved(p);
    } catch (e2) {
      if (e2 instanceof ApiError) { setErrors(e2.fields); setErr(e2.message); } else setErr('Could not save.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {err && <p className="form-error">{err}</p>}
      <p className="pane-title">Account</p>
      <div className="form-grid">
        <Field label="First name" error={errors.first_name}><input value={f.first_name} onChange={set('first_name')} required /></Field>
        <Field label="Last name" error={errors.last_name}><input value={f.last_name} onChange={set('last_name')} /></Field>
        <Field label="Email" error={errors.email}><input type="email" value={f.email} onChange={set('email')} required /></Field>
        <Field label="Username" error={errors.username}><input value={f.username} onChange={set('username')} placeholder="From the email if empty" /></Field>
        <Field label={initial ? 'New password' : 'Password'} error={errors.password}><input type="text" autoComplete="new-password" value={f.password} onChange={set('password')} required={!initial} placeholder={initial ? 'Leave empty to keep' : 'At least 8 characters'} /></Field>
        <Field label="Role" error={errors.role}>
          <select value={f.role} onChange={set('role')}><option value="partner">Partner</option><option value="admin">Admin</option></select>
        </Field>
      </div>
      <hr className="sep" />
      <p className="pane-title">Referral & commission</p>
      <div className="form-grid">
        <Field label="Referral code" error={errors.code}><input value={f.code} onChange={set('code')} placeholder="Generated if empty" style={{ textTransform: 'uppercase' }} /></Field>
        <Field label="Commission group" error={errors.group_id}>
          <select value={f.group_id} onChange={set('group_id')}>
            <option value="">No group</option>
            {options.groups?.map((g) => <option key={g.id} value={g.id}>{g.name} — {g.type === 'fixed' ? `${g.fixed_amount} fixed` : `${Number(g.rate)}%`}</option>)}
          </select>
        </Field>
        <Field label="Custom rate % (optional)" error={errors.custom_rate}><input type="number" step="0.01" min="0" max="100" value={f.custom_rate} onChange={set('custom_rate')} /><span className="hint">Overrides the group for this partner.</span></Field>
        <Field label="Status"><label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={f.is_active} onChange={set('is_active')} /> Active (can sign in)</label></Field>
      </div>
      <hr className="sep" />
      <p className="pane-title">Details</p>
      <div className="form-grid">
        <Field label="Company" error={errors.company}><input value={f.company} onChange={set('company')} /></Field>
        <Field label="Phone" error={errors.phone}><input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Website" error={errors.website} full><input value={f.website} onChange={set('website')} /></Field>
        <Field label="Payout method" error={errors.payout_method}>
          <select value={f.payout_method} onChange={set('payout_method')}>{options.payout_methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
        </Field>
        <Field label="Payout details" error={errors.payout_details}><textarea value={f.payout_details} onChange={set('payout_details')} placeholder="IBAN / PayPal email…" style={{ minHeight: 48 }} /></Field>
        <Field label="Internal notes" error={errors.notes} full><textarea value={f.notes} onChange={set('notes')} /></Field>
      </div>
      <div className="form-foot">
        <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create partner'}</button>
      </div>
    </form>
  );
}

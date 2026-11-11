'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Referral } from '@/lib/types';
import { useApp } from './AppShell';
import { Field } from './ui';

export function ReferralForm({ initial, onSaved, onCancel }: { initial?: Referral; onSaved: (r: Referral) => void; onCancel: () => void }) {
  const { me, options } = useApp();
  const admin = me.is_admin;
  const [f, setF] = useState({
    partner_id: initial?.partner.id ?? '', client_name: initial?.client_name ?? '', client_email: initial?.client_email ?? '',
    client_phone: initial?.client_phone ?? '', company: initial?.company ?? '', project: initial?.project ?? '',
    description: initial?.description ?? '', estimated_value: initial?.estimated_value ?? '', value: initial?.value ?? '',
    status: initial?.status ?? 'new', admin_note: initial?.admin_note ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(''); setErrors({});
    const body: Record<string, unknown> = { ...f, estimated_value: f.estimated_value || null, value: f.value || null };
    if (!admin) { delete body.partner_id; delete body.value; delete body.status; delete body.admin_note; }
    if (admin && !body.partner_id) delete body.partner_id;
    try {
      const r = await api<Referral>(initial ? `referrals/${initial.id}/` : 'referrals/', { method: initial ? 'PATCH' : 'POST', body });
      onSaved(r);
    } catch (e2) {
      if (e2 instanceof ApiError) { setErrors(e2.fields); setErr(e2.message); } else setErr('Could not save.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {err && <p className="form-error">{err}</p>}
      <div className="form-grid">
        {admin && (
          <Field label="Referred by (partner)" error={errors.partner_id} full>
            <select value={f.partner_id} onChange={set('partner_id')} required>
              <option value="">Choose a partner…</option>
              {options.partners?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.code ? ` · ${p.code}` : ''}</option>)}
            </select>
          </Field>
        )}
        <Field label="Client name" error={errors.client_name}><input value={f.client_name} onChange={set('client_name')} required /></Field>
        <Field label="Company" error={errors.company}><input value={f.company} onChange={set('company')} /></Field>
        <Field label="Client email" error={errors.client_email}><input type="email" value={f.client_email} onChange={set('client_email')} /></Field>
        <Field label="Client phone" error={errors.client_phone}><input value={f.client_phone} onChange={set('client_phone')} /></Field>
        <Field label="Project" error={errors.project} full><input value={f.project} onChange={set('project')} placeholder="e.g. Website redesign, mobile app" /></Field>
        <Field label="Details" error={errors.description} full><textarea value={f.description} onChange={set('description')} placeholder="What does the client need? Timeline, budget, contact person…" /></Field>
        <Field label="Estimated value" error={errors.estimated_value}><input type="number" min="0" step="0.01" value={f.estimated_value} onChange={set('estimated_value')} /></Field>
        {admin && <Field label="Final contract value" error={errors.value}><input type="number" min="0" step="0.01" value={f.value} onChange={set('value')} placeholder="Used for the commission" /></Field>}
        {admin && (
          <Field label="Status" error={errors.status}>
            <select value={f.status} onChange={set('status')}>{options.referral_statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </Field>
        )}
        {admin && <Field label="Admin note (not visible to partner)" error={errors.admin_note} full><textarea value={f.admin_note} onChange={set('admin_note')} /></Field>}
      </div>
      {admin && f.status === 'won' && <p className="form-note" style={{ marginTop: 16 }}>Marking a project <b>Won</b> creates a pending commission for the partner from the final value (or the estimate).</p>}
      <div className="form-foot">
        <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add project'}</button>
      </div>
    </form>
  );
}

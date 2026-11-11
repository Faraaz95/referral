'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Empty } from '@/components/kit';
import { CardHead, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { ProgramSettings } from '@/lib/types';

export default function Settings() {
  const { me, options, reloadOptions, notify } = useApp();
  const [f, setF] = useState<ProgramSettings>(options.settings);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  if (!me.is_admin) return <Empty title="Admins only" />;
  const set = (k: keyof ProgramSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('settings/', { method: 'PUT', body: { ...f, currency: f.currency.toUpperCase() } }); await reloadOptions(); notify('Settings saved'); setErrors({}); }
    catch (e2) { if (e2 instanceof ApiError) { setErrors(e2.fields); notify(e2.message, 'error'); } }
  };
  return (
    <>
      <div className="top"><div><h1>Program settings</h1><p className="sub">Applies to every partner.</p></div></div>
      <form className="panes" onSubmit={save}>
        <div className="card pane">
          <CardHead icon="share" title="Program" sub="Shown on the dashboard and the public referral page." />
          <div className="form-grid">
            <Field label="Program name" error={errors.name} full><input value={f.name} onChange={set('name')} /></Field>
            <Field label="Currency (ISO code)" error={errors.currency}><input maxLength={3} value={f.currency} onChange={set('currency')} style={{ textTransform: 'uppercase' }} /></Field>
            <Field label="Terms for partners" error={errors.terms} full><textarea value={f.terms} onChange={set('terms')} placeholder="How commissions are earned, when they are paid…" /></Field>
          </div>
        </div>
        <div className="card pane">
          <CardHead icon="wallet" title="Commissions & payouts" sub="Control when partners can get paid." />
          <div className="form-grid one">
            <Field label="Minimum payout amount" error={errors.min_payout}><input type="number" step="0.01" min="0" value={f.min_payout} onChange={set('min_payout')} /></Field>
            <Field label="Auto-approve commissions after (days)" error={errors.auto_approve_days}><input type="number" min="0" value={f.auto_approve_days} onChange={set('auto_approve_days')} /><span className="hint">0 = an admin approves each commission by hand.</span></Field>
          </div>
        </div>
        <div className="form-foot"><button className="btn primary" type="submit">Save settings</button></div>
      </form>
    </>
  );
}

'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Empty, Modal, Status } from '@/components/kit';
import { Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { date, money } from '@/lib/format';
import type { Commission } from '@/lib/types';

function ManualCommission({ onDone }: { onDone: () => void }) {
  const { options, notify } = useApp();
  const [f, setF] = useState({ partner_id: '', amount: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('commissions/', { body: f }); notify('Commission added'); onDone(); }
    catch (e2) { if (e2 instanceof ApiError) setErrors(e2.fields); }
  };
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Partner" error={errors.partner_id} full>
          <select required value={f.partner_id} onChange={(e) => setF({ ...f, partner_id: e.target.value })}>
            <option value="">Choose…</option>{options.partners?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Amount" error={errors.amount}><input required type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /><span className="hint">Use a negative amount for a correction.</span></Field>
        <Field label="Description" error={errors.description}><input required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Bonus, adjustment…" /></Field>
      </div>
      <div className="form-foot"><button className="btn primary" type="submit">Add commission</button></div>
    </form>
  );
}

function Commissions() {
  const { me, options, notify } = useApp();
  const params = useSearchParams();
  const [rows, setRows] = useState<Commission[] | null>(null);
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [partner, setPartner] = useState(params.get('partner') ?? '');
  const [adding, setAdding] = useState(false);
  const qs = () => new URLSearchParams(Object.entries({ status, partner }).filter(([, v]) => v)).toString();
  const load = () => api<Commission[]>(`commissions/?${qs()}`).then(setRows);
  useEffect(() => { load(); }, [status, partner]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (c: Commission, a: string) => {
    try { await api(`commissions/${c.id}/${a}/`, { method: 'POST' }); notify(`Commission ${a === 'approve' ? 'approved' : a === 'cancel' ? 'cancelled' : 'reopened'}`); load(); }
    catch (e) { notify(e instanceof ApiError ? e.message : 'Failed', 'error'); }
  };
  const approveAll = async () => {
    const r = await api<{ approved: number }>('commissions/approve_all/', { method: 'POST' });
    notify(`${r.approved} commission${r.approved === 1 ? '' : 's'} approved`); load();
  };
  const sum = (s: string) => rows?.filter((c) => c.status === s).reduce((t, c) => t + Number(c.amount), 0) ?? 0;

  return (
    <>
      <div className="top">
        <div><h1>Commissions</h1><p className="sub">{me.is_admin ? 'Approve commissions so partners can request them as a payout.' : 'What you’ve earned from won projects.'}</p></div>
        <div className="top-actions">
          <a className="btn" href={`/api/commissions/export/?${qs()}`}><Icon name="download" />Export</a>
          {me.is_admin && <button className="btn" onClick={approveAll}><Icon name="check" />Approve all pending</button>}
          {me.is_admin && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Manual commission</button>}
        </div>
      </div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        {(['pending', 'approved', 'paid', 'cancelled'] as const).map((s) => (
          <div key={s} className="card stat"><div className="k"><Status value={s} /></div><div className="v">{money(sum(s))}</div></div>
        ))}
      </div>
      <div className="page-tools">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>{options.commission_statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {me.is_admin && (
          <select value={partner} onChange={(e) => setPartner(e.target.value)} aria-label="Partner">
            <option value="">All partners</option>{options.partners?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <div className="card">
        {!rows ? <div className="page-loading">Loading…</div> : !rows.length ? <Empty title="No commissions yet">Commissions appear when referred projects are won.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th>{me.is_admin && <th>Partner</th>}<th>For</th><th className="num-cell">Project value</th><th className="num-cell">Rate</th><th className="num-cell">Amount</th><th>Status</th>{me.is_admin && <th />}</tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id}>
                <td>{date(c.created_at)}</td>
                {me.is_admin && <td>{c.partner.name}</td>}
                <td>{c.referral ? <Link className="row-link" href={`/referrals/${c.referral}`}>{c.referral_name || c.description}</Link> : c.description}</td>
                <td className="num-cell">{Number(c.base_value) ? money(c.base_value) : '—'}</td>
                <td className="num-cell">{Number(c.rate) ? `${Number(c.rate)}%` : '—'}</td>
                <td className="num-cell money">{money(c.amount)}</td>
                <td><Status value={c.status} />{c.payout_ref && <span className="marker">payout {c.payout_ref}</span>}</td>
                {me.is_admin && (
                  <td className="actions"><span className="row-actions-inline">
                    {c.status === 'pending' && <button className="btn sm primary" onClick={() => act(c, 'approve')}>Approve</button>}
                    {(c.status === 'pending' || c.status === 'approved') && !c.payout && <button className="btn sm ghost" onClick={() => act(c, 'cancel')}>Cancel</button>}
                    {c.status === 'cancelled' && <button className="btn sm ghost" onClick={() => act(c, 'reopen')}>Reopen</button>}
                  </span></td>
                )}
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {adding && <Modal title="Manual commission" onClose={() => setAdding(false)}><ManualCommission onDone={() => { setAdding(false); load(); }} /></Modal>}
    </>
  );
}

export default function Page() { return <Suspense><Commissions /></Suspense>; }

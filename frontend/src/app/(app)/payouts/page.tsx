'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Empty, Modal, Status } from '@/components/kit';
import { Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { date, money } from '@/lib/format';
import type { Commission, Payout } from '@/lib/types';

function PayoutDetail({ p, onChanged }: { p: Payout; onChanged: () => void }) {
  const { me, notify } = useApp();
  const [items, setItems] = useState<Commission[] | null>(null);
  const [reference, setReference] = useState(p.reference);
  const [note, setNote] = useState(p.note);
  useEffect(() => { api<Commission[]>(`payouts/${p.id}/commissions/`).then(setItems); }, [p.id]);
  const act = async (a: string) => {
    try { await api(`payouts/${p.id}/${a}/`, { body: { reference, note } }); notify('Payout updated'); onChanged(); }
    catch (e) { notify(e instanceof ApiError ? e.message : 'Failed', 'error'); }
  };
  const open = p.status === 'requested' || p.status === 'processing';
  return (
    <>
      <dl className="kv-list" style={{ marginBottom: 20 }}>
        <dt>Partner</dt><dd>{p.partner.name} <span className="muted">{p.partner.email}</span></dd>
        <dt>Amount</dt><dd className="money">{money(p.amount)}</dd>
        <dt>Status</dt><dd><Status value={p.status} /></dd>
        <dt>Requested</dt><dd>{date(p.requested_at)}</dd>
        {p.paid_at && <><dt>Paid</dt><dd>{date(p.paid_at)}</dd></>}
        <dt>Method</dt><dd>{p.method || '—'}</dd>
        <dt>Pay to</dt><dd className="pre">{p.details || <span className="muted">No payout details on file</span>}</dd>
        {!me.is_admin && p.reference && <><dt>Reference</dt><dd>{p.reference}</dd></>}
        {!me.is_admin && p.note && <><dt>Note</dt><dd className="pre">{p.note}</dd></>}
      </dl>
      <h2>Included commissions</h2>
      {!items ? <div className="page-loading">Loading…</div> : !items.length ? <p className="muted">None.</p> : (
        <table><tbody>{items.map((c) => (
          <tr key={c.id}><td>{c.referral ? <Link className="link" href={`/referrals/${c.referral}`}>{c.referral_name || c.description}</Link> : c.description}<div className="muted small">{date(c.created_at)}</div></td><td className="num-cell money">{money(c.amount)}</td></tr>
        ))}</tbody></table>
      )}
      {me.is_admin && open && (
        <>
          <hr className="sep" />
          <div className="form-grid">
            <Field label="Transaction reference"><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank ref / PayPal id" /></Field>
            <Field label="Note to partner"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <div className="form-foot">
            <button className="btn danger" onClick={() => act('reject')}>Reject</button>
            {p.status === 'requested' && <button className="btn" onClick={() => act('processing')}>Mark processing</button>}
            <button className="btn primary" onClick={() => act('paid')}><Icon name="check" />Mark as paid</button>
          </div>
        </>
      )}
      {!me.is_admin && p.status === 'requested' && <div className="form-foot"><button className="btn danger" onClick={() => act('cancel')}>Withdraw request</button></div>}
    </>
  );
}

function CreateForPartner({ onDone }: { onDone: () => void }) {
  const { options, notify } = useApp();
  const [partner, setPartner] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('payouts/', { body: { partner_id: partner } }); notify('Payout created'); onDone(); }
    catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Failed'); }
  };
  return (
    <form onSubmit={submit}>
      {err && <p className="form-error">{err}</p>}
      <p className="sub" style={{ marginTop: 0 }}>Bundles all of the partner’s approved, unpaid commissions into one payout (no minimum).</p>
      <Field label="Partner"><select required value={partner} onChange={(e) => setPartner(e.target.value)}><option value="">Choose…</option>{options.partners?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <div className="form-foot"><button className="btn primary" type="submit">Create payout</button></div>
    </form>
  );
}

function Payouts() {
  const { me, options, notify } = useApp();
  const [rows, setRows] = useState<Payout[] | null>(null);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<Payout | null>(null);
  const [creating, setCreating] = useState(false);
  const [balance, setBalance] = useState<{ available: number; min: number; busy: boolean } | null>(null);
  const load = () => {
    api<Payout[]>(`payouts/${status ? `?status=${status}` : ''}`).then(setRows);
    if (!me.is_admin) api<{ available: string; min_payout: string; open_payout: Payout | null }>('dashboard/').then((d) => setBalance({ available: Number(d.available), min: Number(d.min_payout), busy: !!d.open_payout }));
  };
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const request = async () => {
    try { await api('payouts/', { body: {} }); notify('Payout requested'); load(); }
    catch (e) { notify(e instanceof ApiError ? e.message : 'Failed', 'error'); }
  };
  return (
    <>
      <div className="top">
        <div><h1>Payouts</h1><p className="sub">{me.is_admin ? 'Payout requests from partners. Mark them paid once the money is sent.' : 'Request your approved balance and see past payouts.'}</p></div>
        <div className="top-actions">
          <a className="btn" href={`/api/payouts/export/${status ? `?status=${status}` : ''}`}><Icon name="download" />Export</a>
          {me.is_admin && <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" />Create payout</button>}
        </div>
      </div>
      {!me.is_admin && balance && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="row-between">
            <div><div className="muted small">Available to withdraw</div><div className="money" style={{ fontSize: 30 }}>{money(balance.available)}</div><div className="muted small">Minimum payout {money(balance.min)} · payouts go to the details in <Link className="link" href="/account">your account</Link></div></div>
            <button className="btn primary" disabled={balance.busy || balance.available <= 0 || balance.available < balance.min} onClick={request}><Icon name="wallet" />{balance.busy ? 'Payout in progress' : 'Request payout'}</button>
          </div>
        </div>
      )}
      <div className="page-tools">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>{options.payout_statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="card">
        {!rows ? <div className="page-loading">Loading…</div> : !rows.length ? <Empty title="No payouts yet" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>#</th>{me.is_admin && <th>Partner</th>}<th>Requested</th><th>Method</th><th>Status</th><th>Paid</th><th className="num-cell">Amount</th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} className="row" onClick={() => setOpen(p)}>
                <td><b>#{p.id}</b></td>
                {me.is_admin && <td>{p.partner.name}<div className="muted small">{p.partner.email}</div></td>}
                <td>{date(p.requested_at)}</td>
                <td>{p.method || '—'}</td>
                <td><Status value={p.status} /></td>
                <td>{date(p.paid_at)}{p.reference && <div className="muted small">{p.reference}</div>}</td>
                <td className="num-cell money">{money(p.amount)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {open && <Modal title={`Payout #${open.id}`} onClose={() => setOpen(null)} wide><PayoutDetail p={open} onChanged={() => { setOpen(null); load(); }} /></Modal>}
      {creating && <Modal title="Create payout" onClose={() => setCreating(false)}><CreateForPartner onDone={() => { setCreating(false); load(); }} /></Modal>}
    </>
  );
}

export default function Page() { return <Suspense><Payouts /></Suspense>; }

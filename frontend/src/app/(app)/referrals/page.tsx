'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Empty, Modal, Status } from '@/components/kit';
import { ReferralForm } from '@/components/ReferralForm';
import { api } from '@/lib/api';
import { date, money } from '@/lib/format';
import type { Referral } from '@/lib/types';

function Referrals() {
  const { me, options, notify } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [partner, setPartner] = useState(params.get('partner') ?? '');
  const [adding, setAdding] = useState(params.get('new') === '1');

  const query = () => {
    const s = new URLSearchParams();
    if (q) s.set('q', q);
    if (status) s.set('status', status);
    if (partner) s.set('partner', partner);
    return s.toString();
  };
  const load = () => api<Referral[]>(`referrals/?${query()}`).then(setRows);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, status, partner]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = rows?.reduce((s, r) => s + Number(r.value ?? r.estimated_value ?? 0), 0) ?? 0;
  return (
    <>
      <div className="top">
        <div><h1>Projects <span className="badge">{rows?.length ?? ''}</span></h1><p className="sub">{me.is_admin ? 'Every project referred through the program.' : 'Projects you referred and where they stand.'}</p></div>
        <div className="top-actions">
          <a className="btn" href={`/api/referrals/export/?${query()}`}><Icon name="download" />Export</a>
          <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />{me.is_admin ? 'Add project' : 'Refer a project'}</button>
        </div>
      </div>
      <div className="page-tools">
        <label className="search"><Icon name="search" /><input placeholder="Search client, company, project…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>{options.referral_statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {me.is_admin && (
          <select value={partner} onChange={(e) => setPartner(e.target.value)} aria-label="Partner">
            <option value="">All partners</option>{options.partners?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <span className="spacer" />
        {rows && <span className="muted small">Total value {money(total, { decimals: false })}</span>}
      </div>
      <div className="card">
        {!rows ? <div className="page-loading">Loading…</div> : !rows.length ? (
          <Empty title="No projects found">{me.is_admin ? 'Add a project or wait for partners to refer one.' : 'Refer your first project, or share your referral link.'}</Empty>
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>Client</th><th>Project</th>{me.is_admin && <th>Partner</th>}<th>Added</th><th>Status</th><th className="num-cell">Value</th><th className="num-cell">Commission</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="row" onClick={() => router.push(`/referrals/${r.id}`)}>
                <td><Link className="row-link" href={`/referrals/${r.id}`} onClick={(e) => e.stopPropagation()}><b>{r.client_name}</b></Link><div className="muted small">{r.company || r.client_email || '—'}</div></td>
                <td>{r.project || <span className="muted">—</span>}{r.source === 'link' && <span className="marker">via link</span>}</td>
                {me.is_admin && <td>{r.partner.name}<div className="muted small">{r.code}</div></td>}
                <td>{date(r.created_at)}</td>
                <td><Status value={r.status} /></td>
                <td className="num-cell">{r.value ? money(r.value) : r.estimated_value ? <span className="muted">~{money(r.estimated_value)}</span> : '—'}</td>
                <td className="num-cell">{r.commission ? <><span className="money">{money(r.commission.amount)}</span><div className="small muted">{r.commission.status}</div></> : <span className="muted">—</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {adding && (
        <Modal title={me.is_admin ? 'Add project' : 'Refer a project'} onClose={() => setAdding(false)}>
          <ReferralForm onCancel={() => setAdding(false)} onSaved={(r) => { setAdding(false); notify('Project added'); router.push(`/referrals/${r.id}`); }} />
        </Modal>
      )}
    </>
  );
}

export default function Page() { return <Suspense><Referrals /></Suspense>; }

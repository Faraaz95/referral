'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Empty, Modal } from '@/components/kit';
import { PartnerForm } from '@/components/PartnerForm';
import { api } from '@/lib/api';
import { money, rateLabel } from '@/lib/format';
import type { Partner } from '@/lib/types';

function Partners() {
  const { me, options, notify } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = useState<Partner[] | null>(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('partner');
  const [group, setGroup] = useState(params.get('group') ?? '');
  const [adding, setAdding] = useState(params.get('new') === '1');
  const qs = () => new URLSearchParams(Object.entries({ q, role, group }).filter(([, v]) => v)).toString();
  const load = () => api<Partner[]>(`partners/?${qs()}`).then(setRows);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, role, group]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me.is_admin) return <Empty title="Admins only" />;
  return (
    <>
      <div className="top">
        <div><h1>{role === 'admin' ? 'Admins' : 'Partners'} <span className="badge">{rows?.length ?? ''}</span></h1><p className="sub">People who refer projects, their codes, commission groups and earnings.</p></div>
        <div className="top-actions">
          <a className="btn" href={`/api/partners/export/?${qs()}`}><Icon name="download" />Export</a>
          <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Add partner</button>
        </div>
      </div>
      <div className="page-tools">
        <label className="search"><Icon name="search" /><input placeholder="Search name, email, code…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="partner">Partners</option><option value="admin">Admins</option><option value="">Everyone</option></select>
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group"><option value="">All groups</option>{options.groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
      </div>
      <div className="card">
        {!rows ? <div className="page-loading">Loading…</div> : !rows.length ? <Empty title="No one here yet"><button className="btn primary" onClick={() => setAdding(true)}>Add partner</button></Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Partner</th><th>Code</th><th>Commission</th><th className="num-cell">Code used</th><th className="num-cell">Won</th><th className="num-cell">Earned</th><th className="num-cell">Paid</th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} className="row" onClick={() => router.push(`/partners/${p.id}`)}>
                <td><div className="who"><span className="av">{p.initials}</span><div><Link className="row-link" href={`/partners/${p.id}`} onClick={(e) => e.stopPropagation()}>{p.name}</Link>{!p.is_active && <span className="marker">inactive</span>}{p.role === 'admin' && <span className="marker">admin</span>}<small>{p.email}{p.company ? ` · ${p.company}` : ''}</small></div></div></td>
                <td><b>{p.code ?? '—'}</b></td>
                <td>{p.group && <span className="group-dot" style={{ background: p.group.color }} />}{p.group?.name ?? <span className="muted">—</span>}<div className="muted small">{rateLabel(p.group, p.custom_rate)}</div></td>
                <td className="num-cell">{p.stats.referrals}<div className="muted small">{p.clicks} visits</div></td>
                <td className="num-cell">{p.stats.won}</td>
                <td className="num-cell money">{money(p.stats.earned)}</td>
                <td className="num-cell">{money(p.stats.paid)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {adding && <Modal wide title="Add partner" onClose={() => setAdding(false)}><PartnerForm onCancel={() => setAdding(false)} onSaved={(p) => { setAdding(false); notify('Partner created'); router.push(`/partners/${p.id}`); }} /></Modal>}
    </>
  );
}

export default function Page() { return <Suspense><Partners /></Suspense>; }

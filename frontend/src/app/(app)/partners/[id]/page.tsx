'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { CopyField, Empty, Modal, Status, useConfirm } from '@/components/kit';
import { PartnerForm } from '@/components/PartnerForm';
import { api, ApiError } from '@/lib/api';
import { date, money, rateLabel, referralLink } from '@/lib/format';
import type { Commission, Partner, Payout, Referral } from '@/lib/types';

export default function PartnerPage() {
  const { id } = useParams<{ id: string }>();
  const { me, notify, reloadOptions } = useApp();
  const router = useRouter();
  const [p, setP] = useState<Partner | null>(null);
  const [refs, setRefs] = useState<Referral[]>([]);
  const [coms, setComs] = useState<Commission[]>([]);
  const [pays, setPays] = useState<Payout[]>([]);
  const [tab, setTab] = useState<'projects' | 'commissions' | 'payouts'>('projects');
  const [editing, setEditing] = useState(false);
  const { pending, ask } = useConfirm();
  const load = () => {
    api<Partner>(`partners/${id}/`).then(setP);
    api<Referral[]>(`referrals/?partner=${id}`).then(setRefs);
    api<Commission[]>(`commissions/?partner=${id}`).then(setComs);
    api<Payout[]>(`payouts/?partner=${id}`).then(setPays);
  };
  useEffect(() => { if (me.is_admin) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me.is_admin) return <Empty title="Admins only" />;
  if (!p) return <div className="page-loading">Loading…</div>;

  const regen = async () => { setP(await api<Partner>(`partners/${p.id}/regenerate_code/`, { method: 'POST' })); notify('New code generated'); reloadOptions(); };
  const remove = async () => {
    try {
      const r = await api<{ deactivated?: boolean }>(`partners/${p.id}/`, { method: 'DELETE' });
      notify(r?.deactivated ? 'Partner has history, so they were deactivated' : 'Partner deleted');
      await reloadOptions();
      router.push('/partners');
    } catch (e) { notify(e instanceof ApiError ? e.message : 'Failed', 'error'); }
  };

  return (
    <>
      <p className="back"><Link className="link" href="/partners">← Partners</Link></p>
      <div className="lead-head">
        <span className="av av-lg">{p.initials}</span>
        <div className="lead-id"><h1>{p.name}{!p.is_active && <span className="badge">inactive</span>}</h1><p className="sub">{p.email}{p.company ? ` · ${p.company}` : ''} · joined {date(p.date_joined)}</p></div>
        <div className="lead-actions">
          <button className="btn sm" onClick={() => setEditing(true)}><Icon name="pen" />Edit</button>
          {p.id !== me.id && <button className={`icon-btn danger${pending === 'del' ? ' confirm' : ''}`} title="Delete" onClick={() => ask('del', remove)}>{pending === 'del' ? 'Delete?' : <Icon name="trash" />}</button>}
        </div>
      </div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        <div className="card stat"><div className="k">Code used</div><div className="v">{p.stats.referrals}</div><div className="d">{p.clicks} link visits</div></div>
        <div className="card stat"><div className="k">Won projects</div><div className="v">{p.stats.won}</div></div>
        <div className="card stat"><div className="k">Earned</div><div className="v">{money(p.stats.earned)}</div><div className="d">{money(p.stats.pending)} pending · {money(p.stats.approved)} approved</div></div>
        <div className="card stat"><div className="k">Paid out</div><div className="v green">{money(p.stats.paid)}</div></div>
      </div>
      <div className="split">
        <div className="card">
          <div className="tabs">
            {(['projects', 'commissions', 'payouts'] as const).map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
          </div>
          {tab === 'projects' && (refs.length ? <table><tbody>{refs.map((r) => (
            <tr key={r.id} className="row" onClick={() => router.push(`/referrals/${r.id}`)}><td><b>{r.client_name}</b><div className="muted small">{r.project || '—'} · {date(r.created_at)}</div></td><td><Status value={r.status} /></td><td className="num-cell money">{r.commission ? money(r.commission.amount) : '—'}</td></tr>
          ))}</tbody></table> : <Empty title="No projects yet" />)}
          {tab === 'commissions' && (coms.length ? <table><tbody>{coms.map((c) => (
            <tr key={c.id}><td>{c.referral_name || c.description}<div className="muted small">{date(c.created_at)}</div></td><td><Status value={c.status} /></td><td className="num-cell money">{money(c.amount)}</td></tr>
          ))}</tbody></table> : <Empty title="No commissions yet" />)}
          {tab === 'payouts' && (pays.length ? <table><tbody>{pays.map((x) => (
            <tr key={x.id}><td><b>#{x.id}</b><div className="muted small">{date(x.requested_at)}</div></td><td><Status value={x.status} /></td><td className="num-cell money">{money(x.amount)}</td></tr>
          ))}</tbody></table> : <Empty title="No payouts yet" />)}
        </div>
        <div className="side-cards">
          <div className="card">
            <h2>Referral code</h2>
            {p.code ? <>
              <div className="code-big" style={{ fontSize: 30, margin: '0 0 14px' }}>{p.code}</div>
              <CopyField light value={referralLink(p.code)} label="Copy link" />
              <p style={{ marginBottom: 0 }}><button className="link small" onClick={regen}>Generate a new code</button></p>
            </> : <p className="muted">No code (admins don’t need one). <button className="link" onClick={regen}>Generate one</button></p>}
          </div>
          <div className="card">
            <h2>Commission</h2>
            <dl className="kv-list">
              <dt>Group</dt><dd>{p.group ? <><span className="group-dot" style={{ background: p.group.color }} />{p.group.name}</> : '—'}</dd>
              <dt>Rate</dt><dd>{rateLabel(p.group, p.custom_rate)}</dd>
              <dt>Payout</dt><dd>{p.payout_method || '—'}</dd>
              <dt>Pay to</dt><dd className="pre">{p.payout_details || '—'}</dd>
              <dt>Phone</dt><dd>{p.phone || '—'}</dd>
              <dt>Notes</dt><dd className="pre">{p.notes || '—'}</dd>
            </dl>
          </div>
        </div>
      </div>
      {editing && <Modal wide title="Edit partner" onClose={() => setEditing(false)}><PartnerForm initial={p} onCancel={() => setEditing(false)} onSaved={(x) => { setP(x); setEditing(false); notify('Saved'); }} /></Modal>}
    </>
  );
}

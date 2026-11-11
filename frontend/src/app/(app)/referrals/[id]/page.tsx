'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Modal, Status, useConfirm } from '@/components/kit';
import { ReferralForm } from '@/components/ReferralForm';
import { api, ApiError } from '@/lib/api';
import { date, money } from '@/lib/format';
import type { Referral } from '@/lib/types';

export default function ReferralPage() {
  const { id } = useParams<{ id: string }>();
  const { me, options, notify } = useApp();
  const router = useRouter();
  const [r, setR] = useState<Referral | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const { pending, ask } = useConfirm();
  const load = () => api<Referral>(`referrals/${id}/`).then(setR).catch(() => setMissing(true));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (missing) return <div className="empty-state"><b>Project not found</b><Link className="btn" href="/referrals">Back to projects</Link></div>;
  if (!r) return <div className="page-loading">Loading…</div>;
  const canEdit = me.is_admin || r.status === 'new';

  const setStatus = async (status: string) => {
    try { setR(await api<Referral>(`referrals/${r.id}/`, { method: 'PATCH', body: { status } })); notify(`Marked ${status}`); }
    catch (e) { notify(e instanceof ApiError ? e.message : 'Could not update', 'error'); }
  };
  const remove = async () => {
    try { await api(`referrals/${r.id}/`, { method: 'DELETE' }); notify('Project deleted'); router.push('/referrals'); }
    catch (e) { notify(e instanceof ApiError ? e.message : 'Could not delete', 'error'); }
  };

  return (
    <>
      <p className="back"><Link className="link" href="/referrals">← Projects</Link></p>
      <div className="lead-head">
        <span className="av av-lg">{r.client_name.slice(0, 2).toUpperCase()}</span>
        <div className="lead-id"><h1>{r.client_name}</h1><p className="sub">{[r.project, r.company].filter(Boolean).join(' · ') || 'Referred project'}</p></div>
        <div className="lead-actions">
          <Status value={r.status} />
          {canEdit && <button className="btn sm" onClick={() => setEditing(true)}><Icon name="pen" />Edit</button>}
          {canEdit && <button className={`icon-btn danger${pending === 'del' ? ' confirm' : ''}`} title="Delete" onClick={() => ask('del', remove)}>{pending === 'del' ? 'Delete?' : <Icon name="trash" />}</button>}
        </div>
      </div>
      {me.is_admin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="row-between">
            <div><b>Move project</b><div className="muted small">Won creates the partner’s commission; Lost cancels an unpaid one.</div></div>
            <div className="seg">
              {options.referral_statuses.map((s) => (
                <button key={s.value} type="button" className={r.status === s.value ? 'active' : ''} onClick={() => r.status !== s.value && setStatus(s.value)}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="split">
        <div className="card">
          <h2>Project</h2>
          <dl className="kv-list">
            <dt>Client</dt><dd>{r.client_name}</dd>
            <dt>Company</dt><dd>{r.company || '—'}</dd>
            <dt>Email</dt><dd>{r.client_email ? <a className="link" href={`mailto:${r.client_email}`}>{r.client_email}</a> : '—'}</dd>
            <dt>Phone</dt><dd>{r.client_phone || '—'}</dd>
            <dt>Project</dt><dd>{r.project || '—'}</dd>
            <dt>Details</dt><dd className="pre">{r.description || '—'}</dd>
            {me.is_admin && <><dt>Admin note</dt><dd className="pre">{r.admin_note || '—'}</dd></>}
          </dl>
        </div>
        <div className="side-cards">
          <div className="card">
            <h2>Value & commission</h2>
            <div className="deal-stats">
              <div><span className="k">Estimated</span><span className="v">{r.estimated_value ? money(r.estimated_value, { decimals: false }) : '—'}</span></div>
              <div><span className="k">Contract value</span><span className="v">{r.value ? money(r.value, { decimals: false }) : '—'}</span></div>
            </div>
            {r.commission ? (
              <div className="row-between">
                <div><div className="muted small">Commission{Number(r.commission.rate) ? ` · ${Number(r.commission.rate)}%` : ''}</div><div className="money" style={{ fontSize: 24 }}>{money(r.commission.amount)}</div></div>
                <Status value={r.commission.status} />
              </div>
            ) : <p className="muted small" style={{ margin: 0 }}>A commission is created when the project is won.</p>}
          </div>
          <div className="card">
            <h2>Referral</h2>
            <dl className="kv-list">
              <dt>Partner</dt><dd>{me.is_admin ? <Link className="link" href={`/partners/${r.partner.id}`}>{r.partner.name}</Link> : r.partner.name}</dd>
              <dt>Code</dt><dd>{r.code || '—'}</dd>
              <dt>Source</dt><dd>{{ partner: 'Added by partner', link: 'Referral link', admin: 'Added by admin' }[r.source]}</dd>
              <dt>Added</dt><dd>{date(r.created_at)}</dd>
              <dt>Won</dt><dd>{date(r.won_at)}</dd>
            </dl>
          </div>
        </div>
      </div>
      {editing && (
        <Modal title="Edit project" onClose={() => setEditing(false)}>
          <ReferralForm initial={r} onCancel={() => setEditing(false)} onSaved={(x) => { setR(x); setEditing(false); notify('Saved'); }} />
        </Modal>
      )}
    </>
  );
}

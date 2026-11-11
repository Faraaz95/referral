'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Bars, CopyField, Empty, Funnel, Status } from '@/components/kit';
import { api, ApiError } from '@/lib/api';
import { date, money, rateLabel, referralLink } from '@/lib/format';
import type { MonthPoint, Payout, Referral } from '@/lib/types';

type Sums = { pending: string | number; approved: string | number; paid: string | number };
interface AdminDash {
  role: 'admin'; partners: number; clicks: number; referrals: number; by_status: Record<string, number>; won_value: string | number;
  commission: Sums; open_payouts: { count: number; amount: string | number; items: Payout[] }; monthly: MonthPoint[];
  top_partners: { id: number; name: string; code: string; referrals: number; won: number; earned: number | string }[]; recent: Referral[];
}
interface PartnerDash {
  role: 'partner'; code: string; clicks: number; referrals: number; won: number; conversion: number; by_status: Record<string, number>;
  commission: Sums; earned: string | number; available: string | number; min_payout: string; open_payout: Payout | null; monthly: MonthPoint[];
  group: { name: string; type: string; rate: string; fixed_amount: string; bonus_threshold: number; bonus_rate: string } | null; custom_rate: string | null; recent: Referral[];
}

function Stat({ k, v, d, icon, tone }: { k: string; v: React.ReactNode; d?: React.ReactNode; icon: string; tone?: string }) {
  return (
    <div className="card stat">
      <span className="stat-ic"><Icon name={icon} /></span>
      <div className="k">{k}</div>
      <div className={`v ${tone ?? ''}`}>{v}</div>
      {d && <div className="d">{d}</div>}
    </div>
  );
}

function RecentTable({ rows, admin }: { rows: Referral[]; admin: boolean }) {
  if (!rows.length) return <Empty title="No projects yet">Referred projects will show up here.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Client / project</th>{admin && <th>Partner</th>}<th>Status</th><th className="num-cell">Commission</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Link className="row-link" href={`/referrals/${r.id}`}><b>{r.client_name}</b></Link><div className="muted small">{r.project || '—'} · {date(r.created_at)}</div></td>
              {admin && <td>{r.partner.name}</td>}
              <td><Status value={r.status} /></td>
              <td className="num-cell money">{r.commission ? money(r.commission.amount) : <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartnerDashboard({ d, reload }: { d: PartnerDash; reload: () => void }) {
  const { me, notify, options } = useApp();
  const [busy, setBusy] = useState(false);
  const link = referralLink(d.code);
  const available = Number(d.available);
  const min = Number(d.min_payout);
  const request = async () => {
    setBusy(true);
    try { await api('payouts/', { body: {} }); notify('Payout requested'); reload(); }
    catch (e) { notify(e instanceof ApiError ? e.message : 'Could not request payout', 'error'); }
    setBusy(false);
  };
  const g = d.group;
  return (
    <>
      <div className="top">
        <div><h1>Hi {me.first_name || me.name} 👋</h1><p className="sub">{options.settings.name} — share your code, track projects and get paid.</p></div>
        <Link className="btn primary" href="/referrals?new=1"><Icon name="plus" />Refer a project</Link>
      </div>
      <div className="hero">
        <div className="card code-card">
          <div className="k">Your referral code</div>
          <div className="code-big">{d.code}</div>
          <div className="copy-row"><CopyField value={link} label="Copy link" /><CopyField value={d.code} label="Copy code" /></div>
        </div>
        <div className="card rate-card">
          <div className="k muted">Your commission</div>
          <div className="big">{rateLabel(g ? { type: g.type, rate: g.rate, fixed_amount: g.fixed_amount } : null, d.custom_rate)}</div>
          <div className="muted small">{g ? <>Group: <b>{g.name}</b></> : 'Ask an admin to assign a commission group.'}</div>
          {g && g.bonus_threshold > 0 && !d.custom_rate && (
            <>
              <div className="progress"><i style={{ width: `${Math.min(100, (d.won / g.bonus_threshold) * 100)}%` }} /></div>
              <div className="small muted">
                {d.won >= g.bonus_threshold ? <>Bonus unlocked: +{g.type === 'fixed' ? money(g.bonus_rate) : `${Number(g.bonus_rate)}%`} on new projects</>
                  : <>{g.bonus_threshold - d.won} more won project{g.bonus_threshold - d.won === 1 ? '' : 's'} to unlock +{g.type === 'fixed' ? money(g.bonus_rate) : `${Number(g.bonus_rate)}%`}</>}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        <Stat k="Code used" v={d.referrals} d={`${d.clicks} link visits`} icon="share" />
        <Stat k="Won projects" v={d.won} d={`${d.conversion}% conversion`} icon="trophy" />
        <Stat k="Total earned" v={money(d.earned)} d={`${money(d.commission.pending)} pending approval`} icon="coins" />
        <Stat k="Paid out" v={money(d.commission.paid)} tone="green" icon="wallet" />
      </div>
      <div className="grid g2" style={{ marginBottom: 20 }}>
        <div className="card"><h2>Commission per month</h2><Bars data={d.monthly} /></div>
        <div className="card">
          <h2>Available balance</h2>
          <div className="balance-row">
            <div><div className="stat"><div className="v brand">{money(available)}</div><div className="d">Minimum payout {money(min)}</div></div></div>
            {d.open_payout
              ? <div className="small">Payout #{d.open_payout.id} of <b>{money(d.open_payout.amount)}</b> is <Status value={d.open_payout.status} /></div>
              : <button className="btn primary" disabled={busy || available < min || available <= 0} onClick={request}><Icon name="wallet" />Request payout</button>}
          </div>
          <div className="progress"><i style={{ width: `${Math.min(100, min ? (available / min) * 100 : 100)}%` }} /></div>
          <hr className="sep" />
          <h2>Pipeline</h2>
          <Funnel byStatus={d.by_status} />
        </div>
      </div>
      <div className="card"><div className="row-between" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Recent projects</h2><Link className="head-link" href="/referrals">All projects<Icon name="arrow" /></Link></div><RecentTable rows={d.recent} admin={false} /></div>
    </>
  );
}

function AdminDashboard({ d }: { d: AdminDash }) {
  const { options } = useApp();
  return (
    <>
      <div className="top">
        <div><h1>Program overview</h1><p className="sub">{options.settings.name}</p></div>
        <div className="top-actions"><Link className="btn" href="/partners?new=1"><Icon name="plus" />Add partner</Link><Link className="btn primary" href="/referrals?new=1"><Icon name="plus" />Add project</Link></div>
      </div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        <Stat k="Active partners" v={d.partners} d={`${d.clicks} referral link visits`} icon="leads" />
        <Stat k="Referred projects" v={d.referrals} d={`${d.by_status.won ?? 0} won · ${money(d.won_value, { decimals: false })} value`} icon="folder" />
        <Stat k="Commissions to approve" v={money(d.commission.pending)} d={<Link className="link" href="/commissions?status=pending">Review</Link>} icon="coins" tone="brand" />
        <Stat k="Payout requests" v={money(d.open_payouts.amount)} d={<>{d.open_payouts.count} open · {money(d.commission.paid)} paid all-time</>} icon="wallet" />
      </div>
      <div className="grid g2" style={{ marginBottom: 20 }}>
        <div className="card"><h2>Commissions per month</h2><Bars data={d.monthly} /></div>
        <div className="card"><h2>Project pipeline</h2><Funnel byStatus={d.by_status} /></div>
      </div>
      <div className="grid g2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="row-between" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Top partners</h2><Link className="head-link" href="/partners">All partners<Icon name="arrow" /></Link></div>
          {d.top_partners.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>Partner</th><th className="num-cell">Projects</th><th className="num-cell">Won</th><th className="num-cell">Earned</th></tr></thead>
              <tbody>{d.top_partners.map((p) => (
                <tr key={p.id}><td><Link className="row-link" href={`/partners/${p.id}`}><b>{p.name}</b></Link><div className="muted small">{p.code}</div></td>
                  <td className="num-cell">{p.referrals}</td><td className="num-cell">{p.won}</td><td className="num-cell money">{money(p.earned)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty title="No partners yet"><Link className="btn primary" href="/partners?new=1">Add a partner</Link></Empty>}
        </div>
        <div className="card">
          <div className="row-between" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Open payout requests</h2><Link className="head-link" href="/payouts">All payouts<Icon name="arrow" /></Link></div>
          {d.open_payouts.items.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>Partner</th><th>Status</th><th className="num-cell">Amount</th></tr></thead>
              <tbody>{d.open_payouts.items.map((p) => (
                <tr key={p.id}><td><b>{p.partner.name}</b><div className="muted small">#{p.id} · {date(p.requested_at)}</div></td><td><Status value={p.status} /></td><td className="num-cell money">{money(p.amount)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty title="Nothing to pay right now" />}
        </div>
      </div>
      <div className="card"><div className="row-between" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Latest projects</h2><Link className="head-link" href="/referrals">All projects<Icon name="arrow" /></Link></div><RecentTable rows={d.recent} admin /></div>
    </>
  );
}

export default function Dashboard() {
  const [d, setD] = useState<AdminDash | PartnerDash | null>(null);
  const load = () => api<AdminDash | PartnerDash>('dashboard/').then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <div className="page-loading">Loading…</div>;
  return d.role === 'admin' ? <AdminDashboard d={d} /> : <PartnerDashboard d={d} reload={load} />;
}

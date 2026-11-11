'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Empty, Modal, useConfirm } from '@/components/kit';
import { Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { money } from '@/lib/format';
import type { Group } from '@/lib/types';

function GroupForm({ initial, onDone }: { initial?: Group; onDone: () => void }) {
  const { notify } = useApp();
  const [f, setF] = useState({
    name: initial?.name ?? '', description: initial?.description ?? '', type: initial?.type ?? 'percent', rate: initial?.rate ?? '10',
    fixed_amount: initial?.fixed_amount ?? '0', bonus_threshold: String(initial?.bonus_threshold ?? 0), bonus_rate: initial?.bonus_rate ?? '0',
    color: initial?.color ?? '#2563eb', is_default: initial?.is_default ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api(initial ? `groups/${initial.id}/` : 'groups/', { method: initial ? 'PATCH' : 'POST', body: f }); notify('Group saved'); onDone(); }
    catch (e2) { if (e2 instanceof ApiError) setErrors(e2.fields); }
  };
  const pct = f.type === 'percent';
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Name" error={errors.name}><input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Color"><input type="color" className="swatch swatch-lg" value={f.color} onChange={set('color')} /></Field>
        <Field label="Description" error={errors.description} full><input value={f.description} onChange={set('description')} /></Field>
        <Field label="Commission type" error={errors.type}>
          <select value={f.type} onChange={set('type')}><option value="percent">Percentage of project value</option><option value="fixed">Fixed amount per won project</option></select>
        </Field>
        {pct ? <Field label="Rate %" error={errors.rate}><input type="number" step="0.01" min="0" max="100" value={f.rate} onChange={set('rate')} /></Field>
          : <Field label="Fixed amount" error={errors.fixed_amount}><input type="number" step="0.01" min="0" value={f.fixed_amount} onChange={set('fixed_amount')} /></Field>}
        <Field label="Bonus after N won projects" error={errors.bonus_threshold}><input type="number" min="0" value={f.bonus_threshold} onChange={set('bonus_threshold')} /><span className="hint">0 = no bonus tier.</span></Field>
        <Field label={pct ? 'Bonus (extra %)' : 'Bonus (extra amount)'} error={errors.bonus_rate}><input type="number" step="0.01" min="0" value={f.bonus_rate} onChange={set('bonus_rate')} /></Field>
        <div className="full"><label className="check"><input type="checkbox" checked={f.is_default} onChange={set('is_default')} /> Default group for new partners</label></div>
      </div>
      <div className="form-foot"><button className="btn ghost" type="button" onClick={onDone}>Cancel</button><button className="btn primary" type="submit">Save group</button></div>
    </form>
  );
}

export default function Groups() {
  const { me, options, reloadOptions, notify } = useApp();
  const [editing, setEditing] = useState<Group | 'new' | null>(null);
  const { pending, ask } = useConfirm();
  if (!me.is_admin) return <Empty title="Admins only" />;
  const groups = options.groups ?? [];
  const remove = async (g: Group) => {
    try { await api(`groups/${g.id}/`, { method: 'DELETE' }); notify('Group deleted'); reloadOptions(); }
    catch (e) { notify(e instanceof ApiError ? e.message : 'Failed', 'error'); }
  };
  return (
    <>
      <div className="top">
        <div><h1>Commission groups</h1><p className="sub">Define how much partners earn, then assign each partner to a group. Partners without a custom rate use their group.</p></div>
        <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" />New group</button>
      </div>
      {!groups.length ? <div className="card"><Empty title="No groups yet" /></div> : (
        <div className="groups-grid">
          {groups.map((g) => (
            <div className="card group-card" key={g.id}>
              <div className="top-line">
                <h2 style={{ margin: 0 }}><span className="group-dot" style={{ background: g.color }} />{g.name}{g.is_default && <span className="pill-soft default" style={{ marginLeft: 8 }}>Default</span>}</h2>
                <span className="row-actions-inline">
                  <button className="icon-btn" title="Edit" onClick={() => setEditing(g)}><Icon name="pen" /></button>
                  <button className={`icon-btn${pending === `d${g.id}` ? ' danger confirm' : ''}`} title="Delete" onClick={() => ask(`d${g.id}`, () => remove(g))}>{pending === `d${g.id}` ? 'Delete?' : <Icon name="trash" />}</button>
                </span>
              </div>
              <div className="big">{g.type === 'fixed' ? money(g.fixed_amount) : `${Number(g.rate)}%`}</div>
              <div className="muted small">{g.type === 'fixed' ? 'per won project' : 'of the project value'}{g.bonus_threshold > 0 && <> · +{g.type === 'fixed' ? money(g.bonus_rate) : `${Number(g.bonus_rate)}%`} after {g.bonus_threshold} won</>}</div>
              {g.description && <p className="small" style={{ margin: 0 }}>{g.description}</p>}
              <Link className="link small" href={`/partners?group=${g.id}`}>{g.members} member{g.members === 1 ? '' : 's'} →</Link>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <Modal title={editing === 'new' ? 'New commission group' : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <GroupForm initial={editing === 'new' ? undefined : editing} onDone={() => { setEditing(null); reloadOptions(); }} />
        </Modal>
      )}
    </>
  );
}

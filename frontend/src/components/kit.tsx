'use client';
import { useEffect, useState } from 'react';
import { money, STATUS_LABEL } from '@/lib/format';
import type { MonthPoint } from '@/lib/types';
import { Icon } from './Icon';

export function Status({ value }: { value: string }) {
  return <span className={`status ${value}`}>{STATUS_LABEL[value] ?? value}</span>;
}

export function Modal({ title, onClose, wide, children }: { title: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}

export function CopyField({ value, light, label = 'Copy' }: { value: string; light?: boolean; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch {
      const t = document.createElement('textarea'); t.value = value; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <div className={`copy-field${light ? ' light' : ''}`}>
      <span title={value}>{value}</span>
      <button className="btn sm" type="button" onClick={copy}><Icon name={done ? 'check' : 'copy'} />{done ? 'Copied' : label}</button>
    </div>
  );
}

export function Bars({ data }: { data: MonthPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="bars">
      {data.map((d) => (
        <div className="b" key={d.month}>
          <span className="tip">{money(d.total)}</span>
          <i style={{ height: `${Math.max(2, (d.total / max) * 150)}px`, opacity: d.total ? undefined : 0.25 }} />
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  );
}

const FUNNEL_COLORS: Record<string, string> = { new: '#2563eb', contacted: '#7c3aed', proposal: '#d97706', won: '#15803d', lost: '#a3a3a2' };
export function Funnel({ byStatus }: { byStatus: Record<string, number> }) {
  const keys = ['new', 'contacted', 'proposal', 'won', 'lost'];
  const max = Math.max(1, ...keys.map((k) => byStatus[k] ?? 0));
  return (
    <div className="funnel">
      {keys.map((k) => (
        <div className="funnel-row" key={k}>
          <span>{STATUS_LABEL[k]}</span>
          <span className="bar-bg"><i style={{ width: `${((byStatus[k] ?? 0) / max) * 100}%`, background: FUNNEL_COLORS[k] }} /></span>
          <b>{byStatus[k] ?? 0}</b>
        </div>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty-state"><b>{title}</b>{children}</div>;
}

export function useConfirm() {
  const [pending, setPending] = useState<string | null>(null);
  const ask = (key: string, fn: () => void) => {
    if (pending === key) { setPending(null); fn(); } else { setPending(key); setTimeout(() => setPending((p) => (p === key ? null : p)), 3000); }
  };
  return { pending, ask };
}

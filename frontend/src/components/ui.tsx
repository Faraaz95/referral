'use client';
import { Icon } from './Icon';

/** Card header in the Settings style: icon tile · title (+ badge) · description · optional actions */
export function CardHead({ icon, title, badge, sub, children }: {
  icon?: string; title: React.ReactNode; badge?: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <header className="set-head">
      {icon && <span className="set-ic"><Icon name={icon} /></span>}
      <div className="set-title">
        <h2>{title}{badge !== undefined && <> <span className="badge">{badge}</span></>}</h2>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children}
    </header>
  );
}

export function Field({ label, error, full, children }: { label: string; error?: string[]; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'full' : undefined}>
      <label>{label}</label>
      {children}
      {error && <small className="field-error">{error.join(' ')}</small>}
    </div>
  );
}

export function TagLabel({ name, color, onRemove }: { name: string; color: string; onRemove?: () => void }) {
  return (
    <span className="tag" style={{ ['--c' as string]: color }}>
      {name}
      {onRemove && <button className="icon-btn" type="button" aria-label={`Remove ${name}`} onClick={onRemove}><Icon name="x" /></button>}
    </span>
  );
}

export const STAGE_ORDER = ['potential', 'won', 'closed'] as const;

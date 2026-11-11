let currency = 'USD';
export const setCurrency = (c: string) => { currency = c || 'USD'; };

export function money(v: number | string | null | undefined, opts: { decimals?: boolean } = {}) {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: opts.decimals === false ? 0 : 2, minimumFractionDigits: opts.decimals === false ? 0 : 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export const date = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function rateLabel(g: { type: string; rate: string | number; fixed_amount: string | number } | null | undefined, custom?: string | null) {
  if (custom != null && custom !== '') return `${Number(custom)}% (custom)`;
  if (!g) return 'No commission group';
  return g.type === 'fixed' ? `${money(g.fixed_amount)} per won project` : `${Number(g.rate)}% of project value`;
}

export const referralLink = (code: string | null | undefined) =>
  code ? `${typeof window === 'undefined' ? '' : window.location.origin}/r/${code}` : '';

export const STATUS_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', proposal: 'Proposal sent', won: 'Won', lost: 'Lost',
  pending: 'Pending', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled',
  requested: 'Requested', processing: 'Processing', rejected: 'Rejected',
};

// Small fetch wrapper for the Django API (same origin via the /api proxy).
export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]>;
  constructor(status: number, message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

const csrfToken = () =>
  typeof document === 'undefined' ? '' : decodeURIComponent(document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? '');

let csrfReady: Promise<unknown> | null = null;
export const ensureCsrf = () => (csrfReady ??= fetch('/api/auth/csrf/', { credentials: 'same-origin' }));

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const method = opts.method ?? (opts.body || opts.form ? 'POST' : 'GET');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    await ensureCsrf();
    headers['X-CSRFToken'] = csrfToken();
  }
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const url = `/api/${path.replace(/^\/+/, '')}`;
  const res = await fetch(url, { method, headers, body, credentials: 'same-origin' });
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : null;
  if (!res.ok) {
    const fields: Record<string, string[]> = {};
    let message = 'Something went wrong. Please try again.';
    if (data && typeof data === 'object') {
      if (typeof data.detail === 'string') message = data.detail;
      for (const [k, v] of Object.entries(data)) if (Array.isArray(v)) fields[k] = v.map(String);
      if (fields.non_field_errors) message = fields.non_field_errors[0];
      else if (!data.detail && Object.keys(fields).length) message = 'Please check the highlighted fields.';
    }
    if (res.status === 403 && !data?.detail) message = 'Please sign in again.';
    throw new ApiError(res.status, message, fields);
  }
  return data as T;
}

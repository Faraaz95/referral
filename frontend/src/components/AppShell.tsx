'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { setCurrency } from '@/lib/format';
import type { Me, Options } from '@/lib/types';
import { Icon } from './Icon';
import { Logo } from './Logo';

type Toast = { id: number; text: string; kind: 'ok' | 'error' };
interface Ctx { me: Me; setMe: (m: Me) => void; options: Options; reloadOptions: () => Promise<void>; notify: (text: string, kind?: Toast['kind']) => void }
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppShell');
  return c;
};

const NAV = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/referrals', label: 'Projects', icon: 'folder' },
  { href: '/commissions', label: 'Commissions', icon: 'coins' },
  { href: '/payouts', label: 'Payouts', icon: 'wallet' },
];
const ADMIN_NAV = [
  { href: '/partners', label: 'Partners', icon: 'leads' },
  { href: '/groups', label: 'Commission groups', icon: 'percent' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 2500);
  }, []);

  const loadOptions = (o: Options) => { setCurrency(o.settings.currency); setOptions(o); };
  const reloadOptions = useCallback(async () => loadOptions(await api<Options>('options/')), []);

  useEffect(() => {
    Promise.all([api<Me>('auth/me/'), api<Options>('options/')])
      .then(([m, o]) => { setMe(m); loadOptions(o); })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403))
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      });
  }, [router]);

  const toggle = () => {
    const root = document.documentElement;
    root.classList.add('nav-anim');
    const on = !root.classList.contains('nav-collapsed');
    root.classList.toggle('nav-collapsed', on);
    try { localStorage.setItem('referral-menu', on ? 'collapsed' : 'open'); } catch {}
  };

  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <div className="app">
      <aside className="side">
        <Logo />
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} title={n.label} className={active(n.href) ? 'active' : ''}>
              <Icon name={n.icon} /><span>{n.label}</span>
            </Link>
          ))}
          {me?.is_admin && ADMIN_NAV.map((n) => (
            <Link key={n.href} href={n.href} title={n.label} className={active(n.href) ? 'active' : ''}>
              <Icon name={n.icon} /><span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <nav className="nav nav-secondary">
          {me?.is_admin && <Link href="/settings" title="Program settings" className={active('/settings') ? 'active' : ''}><Icon name="settings" /><span>Settings</span></Link>}
          <button className="side-toggle" type="button" title="Collapse or expand menu" aria-label="Collapse or expand menu" onClick={toggle}>
            <Icon name="collapse" /><span>Collapse</span>
          </button>
        </nav>
        <div className="side-foot">
          <Link className={`me${active('/account') ? ' active' : ''}`} href="/account" title="Account">
            <span className="av av-me">{me?.initials ?? ''}</span>
            <span className="me-text"><b>{me?.name}</b><small>{me?.is_admin ? 'Admin' : me?.profile.code ? `Code ${me.profile.code}` : me?.email}</small></span>
          </Link>
          <Link className="logout" href="/logout" title="Log out" aria-label="Log out"><Icon name="logout" /></Link>
        </div>
      </aside>
      <main>
        {me && options
          ? <AppCtx.Provider value={{ me, setMe, options, reloadOptions, notify }}>{children}</AppCtx.Provider>
          : <div className="page-loading" aria-busy="true">Loading…</div>}
      </main>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}><Icon name={t.kind === 'ok' ? 'check' : 'x'} />{t.text}</div>
        ))}
      </div>
    </div>
  );
}

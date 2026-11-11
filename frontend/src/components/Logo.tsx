import Link from 'next/link';

export function LogoMark({ className = 'logo-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="3 6.5 26 19" aria-hidden="true">
      <rect x="-5" y="-10" width="10" height="20" rx="5" fill="var(--ink)" transform="translate(12 16) rotate(-45)" />
      <rect x="-5" y="-10" width="10" height="20" rx="5" fill="var(--brand)" transform="translate(20 16) rotate(45)" />
    </svg>
  );
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link className="logo" href={href} aria-label="CraftFlow Referrals home">
      <LogoMark />
      <span className="logo-text"><b className="wordmark"><span className="craft">Craft</span><span className="flow">flow</span></b><small className="logo-sub">Referrals</small></span>
    </Link>
  );
}

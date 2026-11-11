import { Logo } from '@/components/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <main className="auth-wrap">
        <Logo href="/login" />
        <div className="card auth-card">{children}</div>
      </main>
    </div>
  );
}

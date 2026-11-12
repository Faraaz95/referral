import type { Metadata } from 'next';
import { Dancing_Script, Lato } from 'next/font/google';
import './globals.css';

const lato = Lato({ weight: ['400', '700', '900'], subsets: ['latin'], variable: '--font-lato' });
const script = Dancing_Script({ weight: '700', subsets: ['latin'], variable: '--font-script' });

export const metadata: Metadata = {
  title: { default: 'Referral', template: '%s · Referral' },
  description: 'Partner & referral program.',
};

const menuScript = `try{if(localStorage.getItem('referral-menu')==='collapsed')document.documentElement.classList.add('nav-collapsed')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lato.variable} ${script.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: menuScript }} /></head>
      <body>{children}</body>
    </html>
  );
}

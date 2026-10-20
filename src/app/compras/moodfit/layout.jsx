import { Barlow_Condensed, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

const display = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '800'], variable: '--mf-display' });
const body = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--mf-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--mf-mono' });

export const metadata = {
  title: 'Compras Mood Fit',
  robots: { index: false, follow: false },
};

export default function ComprasMoodfitLayout({ children }) {
  return <div className={`${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}

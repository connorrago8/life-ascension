import type { Viewport } from 'next';
import './style.css';

export const metadata = {
  title: 'LIFE ASCENSION',
  description: 'Real actions. Real progress.',
  applicationName: 'LIFE ASCENSION',
  appleWebApp: {
    capable: true,
    title: 'LIFE ASCENSION',
    statusBarStyle: 'black-translucent' as const,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B0F17',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

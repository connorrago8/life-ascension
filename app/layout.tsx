import type { Viewport } from 'next';
import './style.css';
import './companion-dark.css';
import './adventurer-dark.css';
import './polish.css';

export const metadata = {
  title: 'LIFE ASCENSION',
  description: 'Real actions. Real progress.',
  applicationName: 'LIFE ASCENSION',
  appleWebApp: {
    capable: true,
    title: 'LIFE ASCENSION',
    statusBarStyle: 'black-translucent' as const,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0c0e12',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

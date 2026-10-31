import { notFound } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { CryptRecapQAHarness } from './CryptRecapQAHarness';

/** Development-only fixture for the Crypt victory/defeat recap; never available in production or hosted builds. */
export default function CryptRecapQAPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <AppShell><CryptRecapQAHarness /></AppShell>;
}

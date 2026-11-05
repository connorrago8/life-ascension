import { notFound } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { CryptCampQAHarness } from './CryptCampQAHarness';
/** Isolated local display/control fixture. Never available in hosted or production builds. */
export default function CryptCampQAPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <AppShell><CryptCampQAHarness /></AppShell>;
}

import { notFound } from 'next/navigation';
import { QuestProgressQAHarness } from './QuestProgressQAHarness';

/**
 * Development-only, no-backend interaction fixture.
 * This route must NEVER be exposed in a production build.
 */
export default function QuestProgressQAPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <main style={{ maxWidth: 430, margin: '0 auto', padding: 16 }}>
    <h1>Quest progress interaction QA (local only)</h1>
    <p>This fixture mounts the real QuestProgressControls. All responses are in-memory mocks.
      It never authenticates, reads Supabase, or awards XP.</p>
    <QuestProgressQAHarness />
  </main>;
}

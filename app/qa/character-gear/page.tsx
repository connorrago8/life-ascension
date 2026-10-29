import { notFound } from 'next/navigation';
import '../../preview/preview.css';
import { CharacterGearQAHarness } from './CharacterGearQAHarness';

/** Development-only fixture; never available in production or hosted QA builds. */
export default function CharacterGearQAPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <main style={{ maxWidth: 430, margin: '0 auto', padding: 16 }}>
    <h1>Character gear interaction QA (local only)</h1>
    <p>Real CharacterScreen; synthetic ownership and equip responses in localStorage.
      This cannot establish authenticated account persistence or iPhone acceptance.</p>
    <CharacterGearQAHarness />
  </main>;
}

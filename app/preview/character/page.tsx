import type { Metadata } from 'next';
import { CharacterScreen } from '../../../components/preview/CharacterScreen';

export const metadata: Metadata = { title: 'Character · LIFE ASCENSION' };

export default function CharacterPreviewPage() {
  return <CharacterScreen />;
}

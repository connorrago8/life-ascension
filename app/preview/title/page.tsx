import type { Metadata } from 'next';
import { TitleScreen } from '../../../components/preview/TitleScreen';

export const metadata: Metadata = { title: 'LIFE ASCENSION' };

export default function TitlePage() {
  return <TitleScreen />;
}

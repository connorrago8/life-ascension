import type { Metadata } from 'next';
import { CompareScreen } from '../../../components/preview/CompareScreen';

export const metadata: Metadata = { title: 'Same adventurer · LIFE ASCENSION' };

export default function ComparePreviewPage() {
  return <CompareScreen />;
}

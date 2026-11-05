import type { Metadata } from 'next';
import { AdventureScreen } from '../../../components/preview/AdventureScreen';

export const metadata: Metadata = { title: 'Adventure · LIFE ASCENSION' };

export default function AdventurePreviewPage() {
  return <AdventureScreen />;
}

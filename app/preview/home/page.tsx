import type { Metadata } from 'next';
import { HomeScreen } from '../../../components/preview/HomeScreen';

export const metadata: Metadata = { title: 'Home · LIFE ASCENSION' };

export default function HomePreviewPage() {
  return <HomeScreen />;
}

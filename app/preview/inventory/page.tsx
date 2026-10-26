import type { Metadata } from 'next';
import { InventoryScreen } from '../../../components/preview/InventoryScreen';

export const metadata: Metadata = { title: 'Inventory · LIFE ASCENSION' };

export default function InventoryPreviewPage() {
  return <InventoryScreen />;
}

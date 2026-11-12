import { notFound } from 'next/navigation';
import { GalleryScreen } from './screen';

const SCREENS = ['home', 'quests', 'rewards', 'character'] as const;

export default async function CompanionGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<{ open?: string }>;
}) {
  if (process.env.COMPANION_GALLERY !== '1') notFound();
  const { screen } = await params;
  if (!SCREENS.includes(screen as (typeof SCREENS)[number])) notFound();
  const query = await searchParams;
  return <GalleryScreen screen={screen as (typeof SCREENS)[number]} completedOpen={query.open === '1'} />;
}

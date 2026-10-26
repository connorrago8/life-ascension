import QuestNotes from './ui';

export const metadata = { title: 'Quest notes · LIFE ASCENSION' };

export default async function QuestNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestNotes questId={id} />;
}

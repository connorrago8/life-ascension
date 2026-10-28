import QuestNotes from './ui';

export const metadata = { title: 'Quest Detail · LIFE ASCENSION' };

export default async function QuestNotesPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<{instance?:string}> }) {
  const { id } = await params;
  const {instance}=await searchParams;
  return <QuestNotes questId={id} preferredInstance={instance} />;
}

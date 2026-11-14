import QuestNotes from './ui';
import {parseQuestChip,questWorkspaceHref} from '../../../../lib/questWorkspace';
export const metadata = {title:'Task notes · LIFE ASCENSION'};
export default async function QuestNotesPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{chip?:string;area?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);
 return <QuestNotes questId={id} backHref={questWorkspaceHref(parseQuestChip(query.chip??query.area))}/>;
}

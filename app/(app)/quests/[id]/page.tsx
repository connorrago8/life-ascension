import QuestNotes from './ui';
import {parseQuestArea,parseQuestView,questWorkspaceHref} from '../../../../lib/questWorkspace';
export const metadata = {title:'Task notes · LIFE ASCENSION'};
export default async function QuestNotesPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{area?:string;view?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);
 return <QuestNotes questId={id} backHref={questWorkspaceHref(parseQuestArea(query.area),parseQuestView(query.view))}/>;
}

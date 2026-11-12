import {Suspense} from 'react';
import {QuestWorkspace} from '../../../components/quests/QuestWorkspace';
export default function QuestsPage(){return <Suspense fallback={<main className="wrap"><p role="status">Loading quests…</p></main>}><QuestWorkspace/></Suspense>}

import {beginBossSegment,type Boss} from './core';
import {createGame,type State} from './games';

/** Pair the newly selected portal with its exact entry state before any save. */
export function handoffBossSegment(boss:Boss,outgoing:State,seed:number):{boss:Boss;active:State}{
 const id=boss.queue[boss.index];
 if(boss.won||!id)throw new Error('Boss handoff requires a nonterminal selected portal');
 const active=structuredClone(id===outgoing.id?outgoing:(boss.states[id] as State|undefined)??createGame(id,3,seed+id.length));
 active.goal=Number.MAX_SAFE_INTEGER;
 const staged:Boss={...boss,
  states:{...boss.states,[outgoing.id]:outgoing,[id]:active},
  snapshots:{...boss.snapshots,[outgoing.id]:undefined,[id]:undefined}};
 return {boss:beginBossSegment(staged,id,active),active};
}

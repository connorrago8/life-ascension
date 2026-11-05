import {CHECKPOINT_KEY,readCheckpoint,validRun,writeRun,writeActive,type Run,type DungeonCheckpoint} from './core';

export type CheckpointWriteResult='saved'|'conflict'|'unavailable';
/** A tab may replace only the exact checkpoint it loaded or last saved itself.
 * This optimistic guard rejects sequential stale writers; it is not a cross-tab
 * transaction/lock for truly simultaneous read-before-write interleavings.
 */
export function createCheckpointWriter(){
 let expected:string|null=null;
 try{expected=localStorage.getItem(CHECKPOINT_KEY);}catch{/* unavailable */}
 const checkpoint=readCheckpoint();
 return {
  checkpoint,
  isCurrent(){try{return localStorage.getItem(CHECKPOINT_KEY)===expected;}catch{return null;}},
  commit(run:Run,active:DungeonCheckpoint['active']):CheckpointWriteResult{
   try{
    if(localStorage.getItem(CHECKPOINT_KEY)!==expected)return 'conflict';
    if(!validRun(run))return 'unavailable';
    const previous=readCheckpoint();
    const next:DungeonCheckpoint={version:1,run,active:run.boss?.won?null:active,revision:(previous?.revision??0)+1};
    const raw=JSON.stringify(next);
    localStorage.setItem(CHECKPOINT_KEY,raw);
    expected=raw;
    // Authoritative checkpoint first. Obsolete writers touch neither legacy key.
    writeRun(run);writeActive(next.active);
    return 'saved';
   }catch{return 'unavailable';}
  },
 };
}

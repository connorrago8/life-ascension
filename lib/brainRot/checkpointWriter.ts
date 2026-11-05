import {CHECKPOINT_KEY,readCheckpoint,validRun,writeRun,writeActive,type Run,type DungeonCheckpoint} from './core';

export type CheckpointWriteResult='saved'|'conflict'|'unavailable';
export const CHECKPOINT_LOCK='life-ascension:brain-rot:checkpoint-writer:v1';
/** Application writes require an origin-wide Web Lock. The synchronous commit
 * remains a low-level operation for deterministic protocol tests only. */
export function createCheckpointWriter(){
 let expected:string|null=null;
 try{expected=localStorage.getItem(CHECKPOINT_KEY);}catch{/* unavailable */}
 const checkpoint=readCheckpoint();
 const writer={
  checkpoint,
  isCurrent(){try{return localStorage.getItem(CHECKPOINT_KEY)===expected;}catch{return null;}},
  commit(run:Run,active:DungeonCheckpoint['active']):CheckpointWriteResult{
   try{
    if(localStorage.getItem(CHECKPOINT_KEY)!==expected)return 'conflict';
    if(!validRun(run))return 'unavailable';
    const previous=readCheckpoint();
    const next:DungeonCheckpoint={version:1,run,active:run.boss?.won?null:active,revision:(previous?.revision??0)+1};
    const raw=JSON.stringify(next);
    // A storage facade may yield during revision reads/serialization. Recheck
    // before touching either authority or mirrors; production also holds a lock.
    if(localStorage.getItem(CHECKPOINT_KEY)!==expected)return 'conflict';
    localStorage.setItem(CHECKPOINT_KEY,raw);
    expected=raw;
    // Authoritative checkpoint first. Obsolete writers touch neither legacy key.
    writeRun(run);writeActive(next.active);
    return 'saved';
   }catch{return 'unavailable';}
  },
  async commitExclusive(run:Run,active:DungeonCheckpoint['active']):Promise<CheckpointWriteResult>{
   // Never fall back to an optimistic write when serialization is unavailable.
   if(typeof navigator==='undefined'||!navigator.locks)return 'unavailable';
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),2000);
   try{
    // Snapshot at invocation, not when the lock eventually becomes available.
    const snapshot=structuredClone({run,active});
    return await navigator.locks.request(CHECKPOINT_LOCK,{mode:'exclusive',signal:controller.signal},()=>writer.commit(snapshot.run,snapshot.active));
   }catch{return 'unavailable';}
   finally{clearTimeout(timeout);}
  },
 };
 return writer;
}

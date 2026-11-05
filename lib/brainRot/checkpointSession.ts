import type {Run,DungeonCheckpoint} from './core';
import type {CheckpointWriteResult} from './checkpointWriter';

type Snapshot={run:Run;active:DungeonCheckpoint['active']};
type Commit=(run:Run,active:DungeonCheckpoint['active'])=>Promise<CheckpointWriteResult>;
type SaveStatus=CheckpointWriteResult|'saving';
/** Own only this mount's unsaved snapshot. Loading a run never makes it dirty.
 * Retrying still uses the original writer's exclusive lock/freshness authority. */
export function createCheckpointSession(commit:Commit,notify:(status:SaveStatus)=>void){
 let valid=true,sequence=0;
 let latest:Snapshot|null=null,pending:Promise<CheckpointWriteResult>|null=null;
 function enqueue(snapshot:Snapshot):Promise<CheckpointWriteResult>{
  const id=++sequence;latest=snapshot;notify('saving');
  pending=Promise.resolve().then(()=>commit(structuredClone(snapshot.run),structuredClone(snapshot.active)))
   .catch(()=>'unavailable' as const).then(result=>{
    if(!valid)return result;
    // Any freshness conflict invalidates this mount, even if a newer save waits.
    if(result==='conflict'){valid=false;latest=null;pending=null;notify(result);return result;}
    if(id===sequence){pending=null;if(result==='saved')latest=null;notify(result);}
    return result;
   });
  return pending;
 }
 return{
  save(run:Run,active:DungeonCheckpoint['active']):Promise<CheckpointWriteResult>{
   if(!valid)return Promise.resolve('conflict');
   return enqueue(structuredClone({run,active}));
  },
  retry():Promise<CheckpointWriteResult|null>{
   if(!valid||!latest)return Promise.resolve(null);
   // Repeated pause/pagehide/unmount events share an in-flight latest save.
   return pending??enqueue(structuredClone(latest));
  },
  hasDirty(){return valid&&latest!==null;},
  invalidate(){valid=false;latest=null;pending=null;},
 };
}

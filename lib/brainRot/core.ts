export const GAMES = [
  { id:'shadow-sprint', name:'Shadow Sprint', kind:'runner' },
  { id:'temple-of-ruin', name:'Temple of Ruin', kind:'runner' },
  { id:'skybound-slime', name:'Skybound Slime', kind:'climber' },
  { id:'flappy-wyvern', name:'Flappy Wyvern', kind:'flap' },
  { id:'goblin-jetpack', name:'Goblin Jetpack', kind:'jetpack' },
  { id:'frog-kings-crossing', name:"Frog King's Crossing", kind:'crossing' },
  { id:'endless-crossing', name:'Endless Crossing', kind:'crossing' },
  { id:'blade-frenzy', name:'Blade Frenzy', kind:'slice' },
  { id:'hill-glider', name:'Hill Glider', kind:'glide' },
  { id:'rune-fusion', name:'Rune Fusion', kind:'merge' }
] as const;
export type GameId = typeof GAMES[number]['id'];
export type Kind = typeof GAMES[number]['kind'];
export type Run = {version:1; seed:number; order:GameId[]; level:number; hearts:number; best:number; boss?:Boss};
export type Boss = { queue:GameId[]; index:number; segmentMs:number; seconds:Record<GameId,number>; states:Partial<Record<GameId,unknown>>; snapshots:Partial<Record<GameId,unknown>>; hearts:number; won:boolean };
export function rng(seed:number){let n=seed>>>0;return ()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;};}
export function shuffle<T>(values:readonly T[],rand:()=>number):T[]{const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function order(seed:number):GameId[]{const random=rng(seed);const result:GameId[]=[];for(let cycle=0;cycle<3;cycle++){let batch=shuffle(GAMES.map(g=>g.id),random);if(result.length&&batch[0]===result[result.length-1]){const t=batch[0];batch[0]=batch[1];batch[1]=t;}result.push(...batch);}return result;}
export function newRun(seed:number):Run{return {version:1,seed,order:order(seed),level:1,hearts:3,best:1};}
export function tier(level:number){return Math.min(3,Math.floor((level-1)/10)+1);}
export function currentGame(run:Run):GameId{return run.order[Math.min(29,run.level-1)];}
export function completeLevel(run:Run):Run{if(run.level>30)return run;const next=run.level+1;return {...run,level:next,best:Math.max(run.best,next),hearts:3};}
export function newBoss(seed:number):Boss{const ids=GAMES.map(g=>g.id);const seconds=Object.fromEntries(ids.map(id=>[id,0])) as Record<GameId,number>;return {queue:shuffle(ids,rng(seed)),index:0,segmentMs:0,seconds,states:{},snapshots:{},hearts:3,won:false};}
export function advanceBoss(boss:Boss,deltaMs:number,seed:number):Boss{
 if(boss.won||deltaMs<0||!Number.isFinite(deltaMs))return boss;
 const game=boss.queue[boss.index];
 if(!game)return {...boss,won:true};
 const elapsed=boss.segmentMs+deltaMs;
 if(elapsed<15000)return {...boss,segmentMs:elapsed};
 const seconds={...boss.seconds,[game]:Math.min(60,boss.seconds[game]+15)};
 if(GAMES.every(g=>seconds[g.id]===60))return {...boss,seconds,segmentMs:15000,won:true};
 if(boss.index+1<boss.queue.length)return {...boss,seconds,index:boss.index+1,segmentMs:0};
 const remaining=GAMES.map(g=>g.id).filter(id=>seconds[id]<60);
 const completedSeconds=Object.values(seconds).reduce((a,b)=>a+b,0);
 const queue=shuffle(remaining,rng(seed+completedSeconds));
 if(queue.length>1&&queue[0]===game)[queue[0],queue[1]]=[queue[1],queue[0]];
 return {...boss,seconds,queue,index:0,segmentMs:0};
}
export const SAVE_KEY='life-ascension:brain-rot:v1';
export const ACTIVE_KEY='life-ascension:brain-rot:active:v1';
export function readActive():unknown|null{try{const raw=localStorage.getItem(ACTIVE_KEY);return raw?JSON.parse(raw):null;}catch{return null;}}
export function writeActive(value:unknown){try{if(value===null)localStorage.removeItem(ACTIVE_KEY);else localStorage.setItem(ACTIVE_KEY,JSON.stringify(value));}catch{/* unavailable */}}

export function readRun():Run|null{try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;const r=JSON.parse(raw) as Run;if(r.version!==1||!Array.isArray(r.order)||r.order.length!==30||!Number.isInteger(r.level)||r.level<1||r.level>31||!Number.isInteger(r.seed)||!Number.isInteger(r.hearts)||r.hearts<1||r.hearts>3||r.order.some((id:GameId)=>!GAMES.some(g=>g.id===id)))return null;return r;}catch{return null;}}
export function writeRun(run:Run){try{localStorage.setItem(SAVE_KEY,JSON.stringify(run));}catch{/* storage unavailable */}}

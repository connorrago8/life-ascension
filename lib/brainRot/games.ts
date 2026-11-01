import { GAMES, type GameId, rng } from './core';
export type Input = 'left'|'right'|'up'|'down'|'tap'|'hold'|'release'|'slice';
export type Entity = {x:number;y:number;vx:number;vy:number;type:number};
export type State = {id:GameId;tick:number;seed:number;progress:number;goal:number;score:number;player:{x:number;y:number;vx:number;vy:number};entities:Entity[];grid:number[];lost:boolean;won:boolean;pressed:boolean;lastInput:Input|null;lastMeaningfulTick?:number};
const game=(id:GameId)=>GAMES.find(g=>g.id===id)!;
export function createGame(id:GameId,tier:number,seed:number):State{
 const kind=game(id).kind;const goals:Record<string,number[]>={runner:[35,55,75],climber:[25,45,65],flap:[10,20,30],jetpack:[35,55,75],crossing:[12,24,36],slice:[15,30,45],glide:[35,55,75],merge:[128,256,512]};
 const grid=Array(16).fill(0);if(kind==='merge'){const random=rng(seed);const first=Math.floor(random()*16);let second=Math.floor(random()*15);if(second>=first)second++;grid[first]=2;grid[second]=2;}
 return {id,tick:0,seed,progress:0,goal:goals[kind][Math.min(2,tier-1)],score:0,player:{x:0.5,y:0.5,vx:0,vy:0},entities:[],grid,lost:false,won:false,pressed:false,lastInput:null};
}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
function mergeLine(line:number[]):number[]{const compact=line.filter(Boolean),out:number[]=[];for(let i=0;i<compact.length;i++){if(compact[i]===compact[i+1]){out.push(compact[i]*2);i++;}else out.push(compact[i]);}return [...out,...Array(4-out.length).fill(0)];}
export function moveTiles(grid:number[],dir:Input,seed:number):number[]{if(!['left','right','up','down'].includes(dir))return grid;const out=[...grid];for(let i=0;i<4;i++){const idx=Array.from({length:4},(_,j)=>dir==='left'||dir==='right'?i*4+j:j*4+i);if(dir==='right'||dir==='down')idx.reverse();const values=mergeLine(idx.map(k=>grid[k]));idx.forEach((k,j)=>{out[k]=values[j];});}
 if(out.every((v,i)=>v===grid[i]))return grid;
 const empty=out.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(empty.length){const random=rng(seed);out[empty[Math.floor(random()*empty.length)]]=random()<0.9?2:4;}return out;
}
export function step(state:State,input:Input|null,dt=1/60):State{
 if(state.won||state.lost||dt<=0)return state;
 const s:State={...state,tick:state.tick+1,seed:(Math.imul(state.seed,1664525)+1013904223)>>>0,player:{...state.player},entities:state.entities.map(e=>({...e})),grid:[...state.grid],lastInput:input};
 const kind=game(s.id).kind,random=rng(s.seed),speed=dt*(0.16+Math.min(3,s.goal/35)*0.045);
 if(kind==='merge'){
  if(input&&['left','right','up','down'].includes(input)){s.grid=moveTiles(s.grid,input,s.seed);if(s.grid.some((value,index)=>value!==state.grid[index]))s.lastMeaningfulTick=s.tick;s.score=s.grid.reduce((a,b)=>a+b,0);s.progress=Math.max(...s.grid);if(s.progress>=s.goal)s.won=true;else if(!s.grid.includes(0)&&!(['left','right','up','down'] as Input[]).some(d=>{const v=moveTiles(s.grid,d,s.seed);return v.some((n,i)=>n!==s.grid[i]);}))s.lost=true;}
  return s;
 }
 if(kind==='crossing'){
  if(input&&['left','right','up','down'].includes(input)){
   s.player.x=clamp(s.player.x+(input==='left'?-0.12:input==='right'?0.12:0),.05,.95);
   if(input==='up'){if(s.id==='endless-crossing'){s.progress++;s.score+=2;s.player.y=.5;for(const e of s.entities)e.y+=.12;}else s.player.y=clamp(s.player.y-.12,.08,.92);}
   if(input==='down')s.player.y=clamp(s.player.y+.12,.08,.92);
  }
  if(s.tick%45===0){const fromLeft=random()<.5;const lane=s.id==='endless-crossing'?Math.floor(random()*5):(s.tick/45)%5;const velocity=.006*(s.id==='endless-crossing'?1+Math.min(1.5,s.progress/35):1);s.entities.push({x:fromLeft?-.1:1.1,y:s.id==='endless-crossing'?.14+random()*.48:.24+lane*.12,vx:fromLeft?velocity:-velocity,vy:0,type:0});}
  s.entities=s.entities.filter(e=>e.x>-.2&&e.x<1.2&&(s.id!=='endless-crossing'||e.y<1.2)).slice(-16);for(const e of s.entities)e.x+=e.vx;
  if(s.entities.some(e=>Math.abs(e.x-s.player.x)<.055&&Math.abs(e.y-s.player.y)<.065))s.lost=true;
  if(s.id==='frog-kings-crossing'&&s.player.y<=.08&&!s.lost){s.progress++;s.score+=10;s.player.y=.92;}
 }else if(kind==='slice'){
  if(s.tick%28===0)s.entities.push({x:random(),y:1,vx:(random()-.5)*.012,vy:-.024-random()*.008,type:random()<.15?1:0});
  for(const e of s.entities){e.x+=e.vx;e.y+=e.vy;e.vy+=.00065;}
  if(input==='slice'){const candidates=s.entities.filter(e=>e.y>.15&&e.y<.85);const target=candidates[0];if(target){if(target.type===1)s.lost=true;else{s.progress++;s.score+=10;}s.entities=s.entities.filter(e=>e!==target);}}
  s.entities=s.entities.filter(e=>e.y<1.2);
 }else{
  if(input==='left')s.player.x=clamp(s.player.x-.045,.07,.93);
  if(input==='right')s.player.x=clamp(s.player.x+.045,.07,.93);
  if(kind==='flap'){if(input==='tap')s.player.vy=-.012;s.player.vy+=.00065;s.player.y+=s.player.vy;if(s.player.y<=.06||s.player.y>=.94)s.lost=true;}
  else if(kind==='jetpack'){s.player.vy+=(input==='hold'?-.00075:.0006);s.player.vy=clamp(s.player.vy,-.012,.012);s.player.y+=s.player.vy;if(s.player.y<=.06||s.player.y>=.94)s.player.vy=0;}
  else if(kind==='climber'){s.player.vy+=.0005;if(input==='up')s.player.vy=-.016;s.player.y+=s.player.vy;if(s.player.y>.83){s.player.y=.83;s.player.vy=-.014;}}
  else if(kind==='glide'){s.player.vy+=(input==='hold'?.0009:-.00025);s.player.vy=clamp(s.player.vy,-.012,.014);s.player.y+=s.player.vy;if(s.player.y>.83){s.player.y=.83;s.player.vy=-.009;}}
  else if(kind==='runner'){if(input==='up')s.player.y=.28;else s.player.y+=(0.72-s.player.y)*.06;}
  s.player.y=clamp(s.player.y,.06,.94);
  if(kind==='flap'&&s.tick%100===0){
   const center=.32+random()*.36;
   s.entities.push({x:1.08,y:center-.22,vx:-.0045,vy:0,type:2},{x:1.08,y:center+.22,vx:-.0045,vy:0,type:3});
  }else if(kind!=='flap'&&s.tick%Math.max(35,90-Math.floor(s.goal/2))===0){
   const y=kind==='runner'?.72:kind==='jetpack'?clamp(s.player.y+(random()-.5)*.24,.16,.84):.2+random()*.6;
   const collectible=kind==='jetpack'&&Math.floor(s.tick/Math.max(35,90-Math.floor(s.goal/2)))%2===0;
   s.entities.push({x:1.08,y:collectible?s.player.y:y,vx:-speed,vy:0,type:collectible?1:0});
  }
  for(const e of s.entities)e.x+=e.vx;
  s.entities=s.entities.filter(e=>e.x>-.1);
  if(kind==='flap'){
   for(const e of s.entities){
    if((e.type===2||e.type===3)&&Math.abs(e.x-s.player.x)<.045){
     if(e.type===2&&s.player.y<e.y+.11)s.lost=true;
     if(e.type===3&&s.player.y>e.y-.11)s.lost=true;
    }
    if(e.type===2&&e.x<s.player.x&&e.x+0.0045>=s.player.x){s.progress++;s.score+=10;}
   }
  }else{
   if(s.entities.some(e=>(kind!=='jetpack'||e.type!==1)&&Math.abs(e.x-s.player.x)<.045&&Math.abs(e.y-s.player.y)<.09))s.lost=true;
   if(kind==='jetpack'){
    for(const e of s.entities){if(e.type===1&&Math.abs(e.x-s.player.x)<.07&&Math.abs(e.y-s.player.y)<.09){s.progress++;s.score+=10;e.type=2;}}
    s.entities=s.entities.filter(e=>e.type!==2);
   }else if(s.tick%60===0)s.progress++;
  }
 }
 if(s.progress>=s.goal&&!s.lost)s.won=true;
 return s;
}
export function serialize(state:State){return JSON.stringify(state);}
export function restore(serialized:string):State{const s=JSON.parse(serialized) as State;if(!GAMES.some(g=>g.id===s.id)||!Array.isArray(s.entities)||!Array.isArray(s.grid)||!Number.isFinite(s.tick))throw Error('Invalid Brain Rot checkpoint');return s;}

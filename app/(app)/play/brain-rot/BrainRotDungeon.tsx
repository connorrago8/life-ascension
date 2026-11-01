'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {GAMES,newRun,readRun,writeRun,currentGame,completeLevel,newBoss,advanceBoss,tier,type Run,type GameId} from '@/lib/brainRot/core';
import {createGame,step,type State,type Input} from '@/lib/brainRot/games';
const palette=['#f0c86b','#7ed6ba','#ba9cfa','#ff9580','#9ad1ff'];
function Surface({state}:{state:State}){
 const kind=GAMES.find(g=>g.id===state.id)?.kind;
 return <div style={{position:'relative',width:'100%',height:360,overflow:'hidden',borderRadius:18,background:'linear-gradient(160deg,#1d273a,#142923)',border:'2px solid #806b4a',touchAction:'none'}}>
 {kind==='merge'?<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7,padding:18,height:'100%'}}>{state.grid.map((n,i)=><div key={i} style={{display:'grid',placeItems:'center',borderRadius:9,background:n?'#866c45':'#334139',fontSize:25,fontWeight:800,color:'#fff'}}>{n||''}</div>)}</div>:<>
 {kind==='crossing'&&Array.from({length:8},(_,i)=><div key={i} style={{position:'absolute',top:i*45,height:2,width:'100%',background:'#5a6255'}}/>)}
 {state.entities.map((e,i)=><div key={i} style={{position:'absolute',left:(e.x*100)+'%',top:(e.y*100)+'%',width:28,height:28,borderRadius:e.type?2:9,background:e.type?'#e94b65':palette[i%palette.length],transform:'translate(-50%,-50%)',boxShadow:'0 0 10px #0008'}}/>)}
 <div style={{position:'absolute',left:(state.player.x*100)+'%',top:(state.player.y*100)+'%',fontSize:36,transform:'translate(-50%,-50%)'}}>{kind==='flap'?'🐉':kind==='jetpack'?'🚀':kind==='climber'?'🐸':kind==='crossing'?'🐔':kind==='slice'?'⚔️':kind==='glide'?'🪽':'🏃'}</div>
 </>}
 </div>;
}
export default function BrainRotDungeon(){
 const [run,setRun]=useState<Run|null>(null);const [active,setActive]=useState<State|null>(null);const [playing,setPlaying]=useState(false);const [input,setInput]=useState<Input|null>(null);const [message,setMessage]=useState('');const runRef=useRef<Run|null>(null);const activeRef=useRef<State|null>(null);const inputRef=useRef<Input|null>(null);const playingRef=useRef(false);
 useEffect(()=>{const saved=readRun();if(saved){setRun(saved);runRef.current=saved;}else{const r=newRun(Date.now()>>>0);setRun(r);runRef.current=r;writeRun(r);}},[]);
 const persist=useCallback((r:Run)=>{runRef.current=r;setRun(r);writeRun(r);},[]);
 const updateActive=useCallback((s:State|null)=>{activeRef.current=s;setActive(s);},[]);
 const start=useCallback(()=>{const r=runRef.current;if(!r)return;const id=r.level===31?(r.boss?.queue[r.boss.index]??GAMES[0].id):currentGame(r);const saved=r.boss?.states[id] as State|undefined;const fresh=createGame(id,r.level===31?3:tier(r.level),r.seed+r.level*17);if(r.level===31)fresh.goal=Number.MAX_SAFE_INTEGER;updateActive(saved??fresh);setPlaying(true);playingRef.current=true;setMessage('');},[updateActive]);
 const pause=useCallback(()=>{playingRef.current=false;setPlaying(false);const r=runRef.current,s=activeRef.current;if(r?.boss&&s){persist({...r,boss:{...r.boss,states:{...r.boss.states,[s.id]:s}}});}},[persist]);
 useEffect(()=>{const handler=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',handler);return()=>document.removeEventListener('visibilitychange',handler);},[pause]);
 useEffect(()=>{const timer=setInterval(()=>{if(!playingRef.current||!activeRef.current||!runRef.current)return;const r=runRef.current,s=activeRef.current;const next=step(s,inputRef.current);updateActive(next);
 if(next.lost){playingRef.current=false;setPlaying(false);const hearts=r.level===31?(r.boss?.hearts??3):r.hearts;const remaining=hearts-1;if(r.level===31&&r.boss){const b={...r.boss,hearts:remaining,segmentMs:0,states:{...r.boss.states,[s.id]:undefined}};persist({...r,boss:remaining>0?b:newBoss(r.seed+31)});}else{persist({...r,hearts:remaining>0?remaining:3});}setMessage(remaining>0?'Challenge failed — retry!':'All hearts lost — attempt reset.');return;}
 if(r.level===31&&r.boss){const boss=advanceBoss(r.boss,1000/60,r.seed);if(boss.won){persist({...r,boss});playingRef.current=false;setPlaying(false);setMessage('👑 BRAIN ROT KING DEFEATED!');return;}if(boss.queue[0]!==r.boss.queue[0]||boss.segmentMs===0&&r.boss.segmentMs>0){const updated={...boss,states:{...boss.states,[next.id]:next}};persist({...r,boss:updated});const id=updated.queue[0];const fresh=createGame(id,3,r.seed+id.length);fresh.goal=Number.MAX_SAFE_INTEGER;updateActive((updated.states[id] as State|undefined)??fresh);inputRef.current=null;setInput(null);}}
 else if(next.won){const updated=completeLevel(r);if(updated.level===31)updated.boss=newBoss(r.seed+31);persist(updated);playingRef.current=false;setPlaying(false);setMessage(r.level===30?'LEVEL 31 UNLOCKED — THE BRAIN ROT KING AWAITS':'LEVEL COMPLETE — next challenge unlocked!');}
 },1000/60);return()=>clearInterval(timer);},[persist,updateActive]);
 useEffect(()=>{inputRef.current=input;},[input]);
 useEffect(()=>{const down=(e:KeyboardEvent)=>{const map:Record<string,Input>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',' ':'tap'};if(map[e.key]){e.preventDefault();inputRef.current=map[e.key];setInput(map[e.key]);}};const up=()=>{inputRef.current=null;setInput(null);};window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};},[]);
 const press=(value:Input)=>{inputRef.current=value;setInput(value);};const release=()=>{inputRef.current=null;setInput(null);};
 const gameId:GameId=run?.level===31?(run.boss?.queue[0]??GAMES[0].id):run?currentGame(run):GAMES[0].id;
 const game=GAMES.find(g=>g.id===gameId)!;
 return <main style={{maxWidth:600,margin:'0 auto',padding:'18px 16px 100px',color:'#f4f6f8'}}>
 <Link href="/play" style={{color:'#f0c86b'}}>← Back to Hub</Link>
 <h1 style={{fontSize:32,marginBottom:4}}>🧠 Brain Rot</h1><p style={{color:'#bac4bd'}}>30 arcade levels. Ten games. One impossible king.</p>
 <div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap',margin:'14px 0',fontWeight:700}}><span>Level {run?.level??1}/31</span><span>❤️ {run?.level===31?run.boss?.hearts:run?.hearts}</span><span>{run?.level===31?'👑 Final Boss':'Cycle '+(run?tier(run.level):1)}</span></div>
 <h2>{game.name}</h2>{run?.level===31&&run.boss&&<p>King's rotation: {run.boss.seconds[gameId]}/60 seconds · {run.boss.queue.length} portals remaining · {Math.ceil((15000-run.boss.segmentMs)/1000)}s until switch</p>}
 <p>Objective: {run?.level===31?'Survive four 15-second visits':active?.goal??'Complete the challenge'}</p>
 {active?<Surface state={active}/>:<div style={{height:360,display:'grid',placeItems:'center',border:'1px solid #617366',borderRadius:18,background:'#182720'}}>Tap Start to enter {game.name}</div>}
 {active&&<p style={{textAlign:'center'}}>Progress: {active.progress}/{active.goal} · Score: {active.score}</p>}
 <div style={{display:'flex',justifyContent:'center',gap:12,margin:'14px 0'}}>{playing?<button className="btn" onClick={pause}>Pause & Save</button>:<button className="btn" onClick={start}>{active?'Resume / Retry':'Start Challenge'}</button>}</div>
 {message&&<p role="status" style={{textAlign:'center',color:'#f0c86b',fontWeight:700}}>{message}</p>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:18}}>
 {(['left','up','down','right'] as Input[]).map(i=><button key={i} className="btn ghost" style={{minHeight:56}} onPointerDown={()=>press(i)} onPointerUp={release} onPointerCancel={release} onClick={()=>{press(i);setTimeout(release,100);}} disabled={!playing}>{i==='left'?'←':i==='right'?'→':i==='up'?'↑':'↓'}</button>)}
 </div><div style={{display:'flex',gap:8,justifyContent:'center',marginTop:8}}>{(['tap','hold','slice'] as Input[]).map(i=><button key={i} className="btn ghost" onPointerDown={()=>press(i)} onPointerUp={release} onPointerCancel={release} onClick={()=>{press(i);setTimeout(release,100);}} disabled={!playing}>{i==='tap'?'FLAP':i==='hold'?'HOLD / DIVE':'SLICE'}</button>)}</div>
 <p style={{fontSize:13,color:'#aab8ad',marginTop:14}}>Prototype controls: arrows for movement, FLAP for the wyvern, HOLD for jetpack/glider, SLICE for Blade Frenzy. Progress is stored on this device.</p>
 <h3>Dungeon Map</h3><div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:5}}>{Array.from({length:31},(_,i)=><div key={i} title={i===30?'Brain Rot King':GAMES.find(g=>g.id===run?.order[i])?.name} style={{textAlign:'center',padding:'8px 0',borderRadius:5,background:i+1<(run?.level??1)?'#406f51':i+1===(run?.level??1)?'#a17b35':'#303c38',fontSize:12}}>{i===30?'👑':i+1}</div>)}</div>
 </main>;
}

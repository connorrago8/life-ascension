'use client';
import {useState} from 'react';
import Link from 'next/link';

const phases = [
 {name:'Gentle hip mobility',moves:['90/90 seated hip switches — 2 minutes','Half-kneeling hip flexor stretch — 1 minute each side','Supported standing hip circles — 1 minute'],extra:['Adductor rock-backs — 2 minutes','Easy 90/90 holds — 2 minutes each side','Gentle thoracic rotations — 2 minutes']},
 {name:'Increase rotational range',moves:['90/90 switches with slow pauses — 2 minutes','Adductor rock-backs — 1 minute each side','Half-kneeling hip flexor stretch — 1 minute'],extra:['90/90 transitions — 3 minutes','Supported deep squat shifts — 3 minutes','Hip internal-rotation holds — 2 minutes each side']},
 {name:'Active hip control',moves:['Supported hip airplanes — 1 minute each side','Controlled seated hip rotations — 2 minutes','90/90 transitions — 1 minute'],extra:['Single-leg hip control — 3 minutes','Adductor rock-backs — 3 minutes','Hip flexor stretch and controlled rotations — 4 minutes']},
 {name:'Golf swing integration',moves:['Golf-stance pelvic turns — 2 minutes','Trail-hip loading rehearsals — 1 minute','Lead-hip clearing rehearsals — 1 minute','Slow backswing turns — 1 minute'],extra:['Supported hip airplanes — 3 minutes','Step-through rotation drills — 3 minutes','Slow swing rehearsals — 4 minutes']}
];
export default function GolfMobility(){
 const [week,setWeek]=useState(0);
 const p=phases[week];
 return <main className="wrap">
  <div className="eyebrow">PHYSICAL HEALTH · GOLF MOBILITY</div>
  <h1>Unlock the Hips</h1>
  <p>Build a freer backswing with five minutes of daily hip mobility. Aim for 15–20 minutes when time allows.</p>
  <section className="panel">
   <h2>Four-week progression</h2>
   <p className="muted">Choose the week of your program. The minimum routine is five minutes; never force a painful stretch.</p>
   <div className="actions" role="group" aria-label="Mobility program week">
    {phases.map((phase,i)=><button key={i} type="button" className={week===i?'btn':'btn ghost'} aria-pressed={week===i} onClick={()=>setWeek(i)}>Week {i+1}</button>)}
   </div>
   <h3>Week {week+1}: {p.name}</h3>
   <h3>Five-minute minimum</h3><ol>{p.moves.map(m=><li key={m}>{m}</li>)}</ol>
   <h3>Continue toward 15–20 minutes</h3><ol>{p.extra.map(m=><li key={m}>{m}</li>)}</ol>
   <p className="muted">Move slowly and comfortably. Stop for sharp pain. Use support for balance drills.</p>
  </section>
  <section className="panel">
   <h2>Add the recurring quest</h2>
   <p>Open the Quest Board with the daily quest prefilled. Review and save it once. Track five minutes as your completion target. The existing 5 AM day, XP, and single daily streak rules apply.</p>
   <Link className="btn" href="/quests?quest=Unlock%20the%20Hips&domain=physical_health&cadence=daily&target=5&unit=minutes&increment=5">Review and add daily quest</Link>
   <p className="muted">The game awards its standard quest XP—not a separate +1 XP. Completing a five-minute minimum is enough; the longer routine is optional.</p>
  </section>
  <p><Link href="/quests">← Back to Quest Board</Link></p>
 </main>;
}

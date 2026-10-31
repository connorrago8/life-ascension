'use client';

import Link from 'next/link';
import { createContext, useContext, useState, type ReactNode } from 'react';

type Stop = 'hearth' | 'forge' | 'market';
type Visit = { started: boolean; clues: Stop[]; solved: boolean; start: () => void; discover: (stop: Stop) => void; solve: () => void; reset: () => void };
const VisitContext = createContext<Visit | null>(null);
const clues = {
  hearth: { name: 'The Hearth', title: 'Warmth', text: 'Begin where the town gathers for warmth.' },
  forge: { name: 'The Blacksmith', title: 'Craft', text: 'After warmth comes the work of careful hands.' },
  market: { name: 'The Lantern Market', title: 'Light', text: 'When the work is done, carry a light toward the road.' },
} as const;
const order: Stop[] = ['hearth', 'forge', 'market'];

export function TownVisitProvider({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(false);
  const [found, setFound] = useState<Stop[]>([]);
  const [solved, setSolved] = useState(false);
  return <VisitContext.Provider value={{ started, clues: found, solved,
    start: () => setStarted(true),
    discover: stop => setFound(current => current.includes(stop) ? current : [...current, stop]),
    solve: () => setSolved(true),
    reset: () => { setStarted(false); setFound([]); setSolved(false); },
  }}>{children}</VisitContext.Provider>;
}

function useVisit() {
  const visit = useContext(VisitContext);
  if (!visit) throw new Error('Town story requires the town visit layout.');
  return visit;
}

const panel = { padding: 18, marginTop: 20, border: '1px solid #82613e', borderRadius: 14, background: '#242b2b', overflowWrap: 'anywhere' as const };
const action = { minHeight: 44, minWidth: 44, whiteSpace: 'normal' as const, width: '100%', marginTop: 8 };

export function TownTrail() {
  const visit = useVisit();
  return <section aria-labelledby="lantern-route-title" style={panel}>
    <p className="eyebrow">OPTIONAL TOWN STORY · PLAYTEST</p>
    <h2 id="lantern-route-title">The Lantern Route</h2>
    <p>Three neighbors remember the order of an old walking route. Gather their clues, then arrange the signs at the Waystone.</p>
    <p className="muted">This story grants no XP, items, healing or streak credit. It stays with this town visit; leaving town or reloading starts fresh.</p>
    {!visit.started ? <button type="button" className="btn" style={action} onClick={visit.start}>Begin the Lantern Route</button> : <>
      <p role="status">{visit.solved ? 'Lantern Route complete.' : `${visit.clues.length} of 3 clues found.`}</p>
      <ul>{order.map(stop => <li key={stop}>{clues[stop].name}: {visit.clues.includes(stop) ? clues[stop].text : 'Talk to the neighbor here to find a clue.'}</li>)}</ul>
      <Link className="btn" style={action} href={visit.clues.length === 3 ? '/play/emberhaven/waystone' : `/play/emberhaven/${order.find(stop => !visit.clues.includes(stop)) || 'waystone'}`}>{visit.solved ? 'Visit the Waystone' : visit.clues.length === 3 ? 'Arrange the signs at the Waystone' : 'Seek the next clue'} →</Link>
    </>}
  </section>;
}

const dialogue = {
  forge: { name: 'Mara Venn', greeting: 'Good. You brought yourself back.', topic: 'About the forge', response: 'Doors, kettles, shields. Most work starts with a small repair.' },
  hearth: { name: 'Hearth keeper', greeting: 'There is room beside the fire.', topic: 'About this place', response: 'Some sit for a moment. Some stay for a story. The fire asks neither to hurry.' },
  market: { name: 'Lantern keeper', greeting: 'Take a look around. Nothing here needs to be bought.', topic: 'About the lanterns', response: 'A light in the window tells a traveler that someone is still awake.' },
} as const;

export function TownConversation({ stop }: { stop: Stop }) {
  const visit = useVisit();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<'about' | 'clue' | null>(null);
  const npc = dialogue[stop];
  return <section aria-label={`Conversation with ${npc.name}`} style={panel}>
    <h2>{npc.name}</h2>
    <p className="muted">Optional story playtest. Conversation changes no equipment or adventure state.</p>
    <button type="button" className="btn ghost" style={action} aria-expanded={open} aria-controls={`conversation-${stop}`} onClick={() => { setOpen(value => !value); setTopic(null); }}>Talk to {npc.name}</button>
    {open && <div id={`conversation-${stop}`}>
      <p style={{ marginTop: 12 }}>{npc.greeting}</p>
      <button type="button" className="btn ghost" style={action} onClick={() => setTopic('about')}>{npc.topic}</button>
      {visit.started && !visit.solved && <button type="button" className="btn" style={action} onClick={() => { visit.discover(stop); setTopic('clue'); }}>Ask about the Lantern Route</button>}
      <div aria-live="polite" aria-atomic="true" style={{ marginTop: 12 }}>{topic && <p>{topic === 'about' ? npc.response : clues[stop].text}</p>}</div>
      {topic === 'clue' && <p role="status">Clue recorded: {clues[stop].title}. {visit.clues.length} of 3 found.</p>}
    </div>}
  </section>;
}

export function WaystonePuzzle() {
  const visit = useVisit();
  const [placed, setPlaced] = useState<Stop[]>([]);
  const [feedback, setFeedback] = useState('');
  function choose(stop: Stop) {
    const next = [...placed, stop];
    setPlaced(next);
    setFeedback('');
    if (next.length === 3) {
      if (next.every((value, index) => value === order[index])) {
        visit.solve();
        setFeedback('Warmth, craft, then light. The Lantern Route is complete. The road waits whenever you are ready.');
      } else setFeedback('Those signs do not match the clues. Read them again and try another order. Nothing is lost.');
    }
  }
  return <section aria-labelledby="waystone-puzzle-title" style={panel}>
    <h2 id="waystone-puzzle-title">Arrange the route signs</h2>
    {!visit.started ? <p>Begin the optional Lantern Route in Emberhaven square to discover this story.</p> : visit.clues.length < 3 ? <p>Find the three clues at the Hearth, Blacksmith and Lantern Market first. You have {visit.clues.length} of 3.</p> : <>
      <ol>{order.map(stop => <li key={stop}>{clues[stop].text}</li>)}</ol>
      <p>Choose the signs in the order described by your neighbors.</p>
      <p aria-live="polite">Your order: {placed.length ? placed.map(stop => clues[stop].title).join(' → ') : 'No signs placed.'}</p>
      {!visit.solved && <div>{(['market', 'hearth', 'forge'] as Stop[]).map(stop => <button type="button" className="btn ghost" style={action} key={stop} disabled={placed.includes(stop) || placed.length === 3} onClick={() => choose(stop)}>Place {clues[stop].title}</button>)}</div>}
      <p role="status">{feedback || (visit.solved ? 'Lantern Route complete. No rewards or account changes were made.' : '')}</p>
      {!visit.solved && placed.length > 0 && <button type="button" className="btn" style={action} onClick={() => { setPlaced([]); setFeedback('Signs cleared. Choose a new order.'); }}>Rearrange signs</button>}
      {visit.solved && <>
        <p>No XP or items awarded. This was a story for this visit.</p>
        <Link className="btn" style={action} href="/play/emberhaven">Return to Emberhaven →</Link>
        <button type="button" className="btn ghost" style={action} onClick={() => { visit.reset(); setPlaced([]); setFeedback(''); }}>Replay the town story</button>
      </>}
    </>}
  </section>;
}

'use client';

import { ModeLink as Link } from '../../../../components/ModeLink';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  EMPTY_LANTERN, LANTERN_PURPOSE, LANTERN_RESET_COPY, LANTERN_SAVED_COPY, lanternClueCount,
  loadLanternVisit, saveLanternVisit, type LanternProgress, type LanternStop,
} from '../../../../lib/lanternRoute';

type Visit = LanternProgress & {
  ready: boolean;
  saveState: 'loading' | 'loaded' | 'saved' | 'failed';
  retrySave: () => void;
  start: () => void;
  discover: (stop: LanternStop) => void;
  place: (stop: LanternStop) => void;
  clearPlaced: () => void;
  reset: () => void;
};
const VisitContext = createContext<Visit | null>(null);
const clues = {
  hearth: { name: 'The Hearth', title: 'Warmth', href: '/play/emberhaven/hearth', text: 'Begin where the town gathers for warmth.' },
  forge: { name: 'The Blacksmith', title: 'Craft', href: '/play/emberhaven/blacksmith', text: 'After warmth comes the work of careful hands.' },
  market: { name: 'The Lantern Market', title: 'Light', href: '/play/emberhaven/market', text: 'When the work is done, carry a light toward the road.' },
} as const;
const order: LanternStop[] = ['hearth', 'forge', 'market'];

export function TownVisitProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<LanternProgress>(EMPTY_LANTERN);
  const currentRef = useRef<LanternProgress>(EMPTY_LANTERN);
  const readyRef = useRef(false);
  const [saveState, setSaveState] = useState<Visit['saveState']>('loading');
  useEffect(() => {
    const loaded = loadLanternVisit(() => window.localStorage);
    currentRef.current = loaded.progress;
    setProgress(loaded.progress);
    readyRef.current = true;
    setSaveState(loaded.readable ? 'loaded' : 'failed');
    // Loading must never write defaults over an existing or unreadable save.
  }, []);
  function commit(change: (current: LanternProgress) => LanternProgress) {
    if (!readyRef.current) return;
    const next = change(currentRef.current);
    currentRef.current = next;
    // Persist in the action, before a following Hub/navigation click can unmount us.
    const saved = saveLanternVisit(() => window.localStorage, next);
    setProgress(next);
    setSaveState(saved ? 'saved' : 'failed');
  }
  const visit: Visit = {
    ...progress,
    ready: saveState !== 'loading',
    saveState,
    retrySave: () => commit((current) => current),
    start: () => commit((current) => ({ ...current, started: true })),
    discover: (stop) => commit((current) => current.clues.includes(stop) ? current : { ...current, started: true, clues: [...current.clues, stop] }),
    place: (stop) => commit((current) => {
      if (current.solved || current.placed.includes(stop) || current.placed.length === 3 || !current.clues.includes(stop)) return current;
      const placed = [...current.placed, stop];
      const solved = placed.length === 3 && placed.every((value, index) => value === order[index]);
      return { ...current, placed, solved, kept: current.kept || solved };
    }),
    clearPlaced: () => commit((current) => ({ ...current, placed: [] })),
    reset: () => commit((current) => ({ ...EMPTY_LANTERN, kept: current.kept })),
  };
  return <VisitContext.Provider value={visit}>{children}</VisitContext.Provider>;
}

function useVisit() {
  const visit = useContext(VisitContext);
  if (!visit) throw new Error('Town story requires the town visit layout.');
  return visit;
}

const panel = { padding: 18, marginTop: 20, border: '1px solid #82613e', borderRadius: 14, background: '#242b2b', overflowWrap: 'anywhere' as const };
const action = { minHeight: 44, minWidth: 44, whiteSpace: 'normal' as const, width: '100%', marginTop: 8 };

function LanternSaveStatus() {
  const visit = useVisit();
  return <div aria-live="polite" aria-atomic="true">
    <p>{visit.saveState === 'loading' ? 'Loading your town story…'
      : visit.saveState === 'failed' ? 'Device save unavailable. This story can continue for this town visit, but leaving or reloading may lose unsaved progress.'
      : visit.saveState === 'saved' ? LANTERN_SAVED_COPY
      : 'Town story loaded. Progress saves on this device when you make a choice.'}</p>
    {visit.saveState === 'failed' && <button type="button" className="btn ghost" style={action} onClick={visit.retrySave}>Retry device save</button>}
  </div>;
}

export function TownTrail() {
  const visit = useVisit();
  const found = lanternClueCount(visit);
  const nextStop = order.find((stop) => !visit.clues.includes(stop));
  return <section aria-labelledby="lantern-route-title" data-lantern-kept={visit.kept ? 'yes' : 'no'} style={panel}>
    <p className="eyebrow">TOWN STORY</p>
    <h2 id="lantern-route-title">The Lantern Route</h2>
    <p>{LANTERN_PURPOSE}</p>
    <LanternSaveStatus />
    {visit.kept && <p role="status">Lantern kept. The square lantern stays lit. This is a keepsake, not XP.</p>}
    <p className="muted">{LANTERN_RESET_COPY}</p>
    {!visit.started ? <button type="button" className="btn" style={action} disabled={!visit.ready} onClick={visit.start}>Begin the Lantern Route</button> : <>
      <p role="status">{visit.solved ? 'Lantern Route complete.' : `${found} of 3 clues found.`}</p>
      <ul>{order.map(stop => <li key={stop}>{clues[stop].name}: {visit.clues.includes(stop) ? clues[stop].text : 'Talk to the neighbor here to find a clue.'}</li>)}</ul>
      <Link className="btn" style={action} href={found === 3 || !nextStop ? '/play/emberhaven/waystone' : clues[nextStop].href}>{visit.solved ? 'Visit the Waystone' : found === 3 ? 'Arrange the signs at the Waystone' : 'Seek the next clue'} →</Link>
      <button type="button" className="btn ghost" style={action} onClick={visit.reset}>Reset the Lantern Route</button>
    </>}
  </section>;
}

const dialogue = {
  forge: { name: 'Mara Venn', greeting: 'Good. You brought yourself back.', topic: 'About the forge', response: 'Doors, kettles, shields. Most work starts with a small repair.' },
  hearth: { name: 'Hearth keeper', greeting: 'There is room beside the fire.', topic: 'About this place', response: 'Some sit for a moment. Some stay for a story. The fire asks neither to hurry.' },
  market: { name: 'Lantern keeper', greeting: 'Take a look around. Nothing here needs to be bought.', topic: 'About the lanterns', response: 'A light in the window tells a traveler that someone is still awake.' },
} as const;

export function TownConversation({ stop }: { stop: LanternStop }) {
  const visit = useVisit();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<'about' | 'clue' | null>(null);
  const npc = dialogue[stop];
  return <section aria-label={`Conversation with ${npc.name}`} style={panel}>
    <h2>{npc.name}</h2>
    <LanternSaveStatus />
    <p className="muted">A conversation here changes no equipment, XP, or adventure state.</p>
    <button type="button" className="btn ghost" style={action} aria-expanded={open} aria-controls={`conversation-${stop}`} onClick={() => { setOpen(value => !value); setTopic(null); }}>Talk to {npc.name}</button>
    {open && <div id={`conversation-${stop}`}>
      <p style={{ marginTop: 12 }}>{npc.greeting}</p>
      <button type="button" className="btn ghost" style={action} onClick={() => setTopic('about')}>{npc.topic}</button>
      {visit.ready && visit.started && !visit.solved && <button type="button" className="btn" style={action} onClick={() => { visit.discover(stop); setTopic('clue'); }}>Ask about the Lantern Route</button>}
      <div aria-live="polite" aria-atomic="true" style={{ marginTop: 12 }}>{topic && <p>{topic === 'about' ? npc.response : clues[stop].text}</p>}</div>
      {topic === 'clue' && <p role="status">Clue recorded: {clues[stop].title}. {lanternClueCount(visit)} of 3 found.</p>}
    </div>}
  </section>;
}

export function WaystonePuzzle() {
  const visit = useVisit();
  const [feedback, setFeedback] = useState('');
  function choose(stop: LanternStop) {
    const before = visit.placed.length;
    visit.place(stop);
    const nextLength = before + (visit.placed.includes(stop) ? 0 : 1);
    if (nextLength < 3) { setFeedback(''); return; }
    const next = visit.placed.includes(stop) ? visit.placed : [...visit.placed, stop];
    if (next.length === 3 && next.every((value, index) => value === order[index])) {
      setFeedback('Warmth, craft, then light. The Lantern Route is complete. The square lantern stays lit. No XP, items, or streaks were changed.');
    } else if (next.length === 3) {
      setFeedback('Those signs do not match the clues. Read them again and try another order. Nothing is lost.');
    }
  }
  return <section aria-labelledby="waystone-puzzle-title" style={panel}>
    <h2 id="waystone-puzzle-title">Arrange the route signs</h2>
    <LanternSaveStatus />
    {!visit.started ? <p>Begin the Lantern Route in Emberhaven square. {LANTERN_PURPOSE}</p> : visit.clues.length < 3 ? <p>Find the three clues at the Hearth, Blacksmith and Lantern Market first. You have {visit.clues.length} of 3.</p> : <>
      <ol>{order.map(stop => <li key={stop}>{clues[stop].text}</li>)}</ol>
      <p>Choose the signs in the order described by your neighbors.</p>
      <p aria-live="polite">Your order: {visit.placed.length ? visit.placed.map(stop => clues[stop].title).join(' → ') : 'No signs placed.'}</p>
      {!visit.solved && <div>{(['market', 'hearth', 'forge'] as LanternStop[]).map(stop => <button type="button" className="btn ghost" style={action} key={stop} disabled={visit.placed.includes(stop) || visit.placed.length === 3} onClick={() => choose(stop)}>Place {clues[stop].title}</button>)}</div>}
      <p role="status">{feedback || (visit.solved ? 'Lantern Route complete. No rewards or account changes were made.' : '')}</p>
      {!visit.solved && visit.placed.length > 0 && <button type="button" className="btn" style={action} onClick={() => { visit.clearPlaced(); setFeedback('Signs cleared. Choose a new order.'); }}>Rearrange signs</button>}
      {visit.solved && <>
        <p>Lantern kept. The square remembers this route. No XP or items were awarded.</p>
        <Link className="btn" style={action} href="/play/emberhaven">Return to Emberhaven →</Link>
        <button type="button" className="btn ghost" style={action} onClick={() => { visit.reset(); setFeedback(''); }}>Reset the Lantern Route</button>
      </>}
    </>}
  </section>;
}

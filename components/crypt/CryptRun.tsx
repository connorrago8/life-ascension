'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SPRITES } from '../../lib/crypt/art';
import {
  COMBAT,
  END_CARD,
  FLOOR,
  GATE,
  GUARDIAN_ID,
  INTRO,
  NODES,
  PREVIEW_BANNER,
  SIGIL,
  charmNote,
  endCardParagraphs,
  eventNode,
  nextCryptObjective,
  runStatus,
  treasureNode,
} from '../../lib/crypt/content';
import { createRun, nodeAccess, reduceRun, type Phase, type RunState } from '../../lib/crypt/run';
import { CombatView } from './CombatView';
import { PixelArt } from './PixelArt';

function freshSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] || 1;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

function heading(phase: Phase): { title: string; subtitle?: string } {
  if (phase === 'intro') return { title: INTRO.place };
  if (phase === 'gate') return { title: GATE.title };
  if (phase === 'fight') return { title: COMBAT.title };
  if (phase === 'event') return { title: eventNode().label };
  if (phase === 'treasure') return { title: treasureNode().label };
  return { title: FLOOR.title, subtitle: FLOOR.floor };
}

export function CryptRun() {
  const [run, setRun] = useState<RunState | null>(null);
  const [endingChoice, setEndingChoice] = useState<'leave' | 'inspect' | null>(null);
  const [showFieldNotes, setShowFieldNotes] = useState(false);

  useEffect(() => {
    setRun(createRun(freshSeed()));
  }, []);

  useEffect(() => {
    if (run) window.scrollTo(0, 0);
  }, [run?.phase]);

  function restart() {
    setEndingChoice(null);
    setShowFieldNotes(false);
    setRun(createRun(freshSeed()));
  }

  if (!run) {
    return (
      <main className="screen crypt-screen">
        <p className="page-brand">LIFE ASCENSION</p>
        <p className="preview-banner" role="status">{PREVIEW_BANNER}</p>
        <p className="muted">{FLOOR.loading}</p>
      </main>
    );
  }

  const head = heading(run.phase);
  const event = eventNode();
  const treasure = treasureNode();

  return (
    <main className="screen crypt-screen" data-phase={run.phase}>
      <p className="page-brand">LIFE ASCENSION</p>
      <p className="preview-banner" role="status">{PREVIEW_BANNER}</p>
      <header className="crypt-top">
        {run.phase === 'intro' ? (
          <Link href="/play" className="icon-btn" aria-label={FLOOR.back}><BackIcon /></Link>
        ) : (
          <button type="button" className="icon-btn" aria-label={FLOOR.back} onClick={() => setRun(reduceRun(run, { type: 'back' }))}>
            <BackIcon />
          </button>
        )}
        <div className="crypt-heading">
          <h1>{head.title}</h1>
          {head.subtitle ? <p>{head.subtitle}</p> : null}
        </div>
        <button type="button" className="btn ghost crypt-restart" onClick={restart}>{FLOOR.restart}</button>
      </header>

      {run.phase === 'intro' && (
        <article className="story-card">
          <div className="story-portrait"><PixelArt rows={SPRITES.mira} label={INTRO.speaker} /></div>
          <p className="lock-kicker">{INTRO.place}</p>
          <h2>{INTRO.speaker}</h2>
          <p className="story-role">{INTRO.role}</p>
          {INTRO.lines.map((line) => <p key={line}>{line}</p>)}
          <button type="button" className="btn crypt-block" onClick={() => setRun(reduceRun(run, { type: 'continue' }))}>
            {INTRO.continue}
          </button>
        </article>
      )}

      {run.phase === 'gate' && (
        <article className="story-card">
          <div className="story-portrait story-portrait-dark"><PixelArt rows={SPRITES.gate} /></div>
          <h2>{GATE.title}</h2>
          {GATE.lines.map((line) => <p key={line}>{line}</p>)}
          <button type="button" className="btn crypt-block" onClick={() => setRun(reduceRun(run, { type: 'continue' }))}>
            {GATE.continue}
          </button>
        </article>
      )}

      {run.phase === 'map' && (
        <div className="floor-wrap">
          <p className="floor-kicker">{FLOOR.mapLabel}</p>
          <p className="crypt-status">{runStatus(run.hp, run.maxHp, run.attackBonus)}</p>
          <p className="crypt-status">Next objective: {nextCryptObjective(run)}</p>
          <button type="button" className="btn ghost crypt-block" aria-expanded={showFieldNotes}
            onClick={() => setShowFieldNotes((value) => !value)}>
            {showFieldNotes ? 'Hide' : 'Open'} Wayfarer field journal
          </button>
          {showFieldNotes && (
            <aside className="crypt-journal" aria-label="Wayfarer field journal">
              <h2>Field journal</h2>
              <p><strong>Crypt Rat:</strong> {run.fightCleared ? 'Defeated. The first passage is clear.' : 'Unexplored. Something skitters ahead.'}</p>
              <p><strong>Inscription:</strong> {run.eventCleared ? run.hint ?? run.outcomeNote ?? (run.eventChoiceId === 'warning' ? 'A warning about the sealed door.' : 'Ancient restorative words.') : 'Its meaning remains hidden.'}</p>
              <p><strong>Ember Charm:</strong> {run.treasureCleared ? 'Recovered. +2 attack for this preview only.' : 'Not yet discovered.'}</p>
              <p><strong>Guardian:</strong> {run.guardianCleared ? 'Crypt Sentinel defeated; the sealed door is reachable.' : run.treasureCleared ? 'An armored watcher blocks the final passage.' : 'Unexplored.'}</p>
              <p><strong>{SIGIL.name}:</strong> {run.sigilCollected ? SIGIL.description : 'Not yet recovered.'}</p>
              <p><strong>Compass:</strong> {run.treasureCleared ? 'Its broken needle points toward something beneath the crypt.' : 'Not yet discovered. The sealed door may hold an answer.'}</p>
              <p className="muted">Field notes are temporary and reset when the preview restarts.</p>
            </aside>
          )}
          <div className="floor-map">
            {NODES.map((node, index) => {
              const access = nodeAccess(run, node.id);
              const sprite = node.id === GUARDIAN_ID ? SPRITES.sentinel : node.kind === 'fight' ? SPRITES.skull : node.kind === 'event' ? SPRITES.scroll : SPRITES.chest;
              const stateLabel = access === 'done' ? FLOOR.done : access === 'ready' ? FLOOR.open : FLOOR.locked;
              return (
                <div key={node.id} className="floor-step">
                  {index > 0 ? <span className="floor-link" aria-hidden="true" /> : null}
                  <button
                    type="button"
                    className={`floor-node is-${access}`}
                    disabled={access !== 'ready'}
                    aria-label={`${node.label}: ${node.title}. ${stateLabel}`}
                    onClick={() => setRun(reduceRun(run, { type: 'open', nodeId: node.id }))}
                  >
                    <span className="floor-orb"><PixelArt rows={sprite} /></span>
                    <span className="floor-copy">
                      <span className="floor-kind">{node.label}</span>
                      <span className="floor-title">{node.title}</span>
                      <span className="floor-detail">{access === 'ready' ? node.detail : stateLabel}</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <ul className="floor-legend">
            {NODES.map((node) => <li key={node.id}>{node.label}</li>)}
          </ul>
          {run.guardianCleared && (
            <button type="button" className="btn crypt-block" onClick={() => setRun(reduceRun(run, { type: 'continue' }))}>
              {FLOOR.door}
            </button>
          )}
        </div>
      )}

      {run.phase === 'fight' && run.battle && (
        <CombatView
          battle={run.battle}
          onAction={(action) => setRun(reduceRun(run, { type: 'combat', action }))}
          onContinue={() => setRun(reduceRun(run, { type: 'continue' }))}
          onRetry={() => setRun(reduceRun(run, { type: 'retry-fight' }))}
        />
      )}

      {run.phase === 'event' && (
        <article className="story-card">
          <div className="story-portrait story-portrait-dark"><PixelArt rows={SPRITES.tablet} /></div>
          <p className="lock-kicker">{event.label}</p>
          <h2>{event.title}</h2>
          <p>{event.prose}</p>
          {run.outcomeNote ? (
            <>
              <p className="ok">{run.outcomeNote}</p>
              <button type="button" className="btn crypt-block" onClick={() => setRun(reduceRun(run, { type: 'continue' }))}>
                {event.continue}
              </button>
            </>
          ) : (
            <div className="choice-list">
              {event.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className="btn ghost crypt-block"
                  onClick={() => setRun(reduceRun(run, { type: 'choose', choiceId: choice.id }))}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          )}
        </article>
      )}

      {run.phase === 'treasure' && (
        <article className="story-card">
          <div className="story-portrait story-portrait-dark"><PixelArt rows={SPRITES.ember} label={treasure.title} /></div>
          <p className="lock-kicker">{treasure.label}</p>
          <h2>{treasure.title}</h2>
          <p>{treasure.prose}</p>
          <button type="button" className="btn crypt-block" onClick={() => setRun(reduceRun(run, { type: 'continue' }))}>
            {treasure.take}
          </button>
        </article>
      )}

      {run.phase === 'end' && (
        <article className="story-card end-card">
          <div className="compass-twitch">
            <PixelArt rows={SPRITES.compass} label={END_CARD.artifact} />
          </div>
          <h2>{END_CARD.title}</h2>
          {endCardParagraphs().map((line) => (
            <p key={line} className={line === END_CARD.kicker ? 'end-kicker' : undefined}>{line}</p>
          ))}
          {run.attackBonus > 0 ? <p>{charmNote(run.attackBonus)}</p> : null}
          {run.sigilCollected ? <p>{END_CARD.sigil}</p> : null}
          {run.hint ? <p className="muted">{run.hint}</p> : null}
          <p className="crypt-status">{runStatus(run.hp, run.maxHp, run.attackBonus)}</p>
          <section className="crypt-epilogue" aria-label="Sealed door choices">
            <h3>What will the Wayfarer do?</h3>
            {endingChoice === null ? (
              <div className="choice-list">
                <button type="button" className="btn ghost crypt-block" onClick={() => setEndingChoice('inspect')}>Inspect the compass</button>
                <button type="button" className="btn ghost crypt-block" onClick={() => setEndingChoice('leave')}>Return to Brackenlight</button>
              </div>
            ) : endingChoice === 'inspect' ? (
              <p role="status">Beneath the cracked glass, the needle points downward—not north. The sealed sanctuary waits below. The compass cannot open it yet.</p>
            ) : (
              <p role="status">You mark the entrance with a small cairn and return to Mira. The crypt will be here when your journey continues.</p>
            )}
            {endingChoice !== null ? (
              <button type="button" className="btn ghost crypt-block" onClick={() => setEndingChoice(null)}>Choose another ending</button>
            ) : null}
          </section>
          <button type="button" className="btn crypt-block" onClick={restart}>{END_CARD.restart}</button>
        </article>
      )}

    </main>
  );
}

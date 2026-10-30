'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AdventurerSprite } from '../AdventurerSprite';
import { PALETTE } from '../spriteArt';
import { canPlay, ENERGY_PER_TURN, foeIntent, intentText, previewDamage, type Battle } from '../../lib/crypt/delve/battle';
import { CARDS, effectiveness, ELEMENT_LABEL, resistancesOf, TYPE_LABEL, weaknessesOf, type CardId } from '../../lib/crypt/delve/cards';
import { checkChance, eventById, FLOOR_NAME, FLOOR_ROWS, roomHint, roomTitle, ROOM_LABEL, type Room } from '../../lib/crypt/delve/floor';
import { GEAR_INKS, gearOverlays } from '../../lib/crypt/delve/gearArt';
import { bonusLabel, bestLoadout, lootById, RARITY_LABEL, type Loadout } from '../../lib/crypt/delve/loot';
import { MONSTER_PALETTE, MONSTER_SPRITES } from '../../lib/crypt/delve/monsterArt';
import {
  createDelve, currentRoomChoices, effectiveAttributes, reduceDelve, type DelveCommand, type DelveState,
} from '../../lib/crypt/delve/run';
import {
  adjustAttribute, ATTRIBUTE_INFO, ATTRIBUTE_KEYS, clampAllocation, critChance, dodgeChance, maxHpFor, pointsForLevel, spentPoints,
  ZERO_ATTRIBUTES, type Attributes,
} from '../../lib/crypt/delve/stats';

/**
 * The Crypt delve screen. Pure UI: it knows nothing about accounts. The parent
 * passes the hero's level (from real quests), saved attributes and vault gear,
 * and receives callbacks when gear drops or a floor is cleared.
 * State lives only in this component, so leaving the page ends the run.
 * Nothing here runs on a timer: a hidden tab can never lose a fight.
 */
export type DelveRunProps = {
  level: number;
  savedAttributes: Attributes;
  vaultItemIds: readonly string[];
  /** One line about where loot and checkpoints are kept. */
  keepNote: string;
  exitHref: string;
  onSaveAttributes: (attributes: Attributes) => Promise<boolean>;
  onLoot: (runId: string, dropIndex: number, itemId: string) => void;
  onFloorCleared: (runId: string, floor: number) => Promise<string>;
};

const HERO_PALETTE = { ...PALETTE, ...GEAR_INKS };

function newRunId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 32; i += 1) out += hex[Math.floor(Math.random() * 16)];
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-4${out.slice(13, 16)}-a${out.slice(17, 20)}-${out.slice(20, 32)}`;
}

function newSeed(): number {
  return Math.floor(Math.random() * 4294967295);
}

type Holder = { state: DelveState | null };
type Action = { kind: 'start'; state: DelveState } | { kind: 'command'; command: DelveCommand } | { kind: 'clear' };
function holderReducer(holder: Holder, action: Action): Holder {
  if (action.kind === 'start') return { state: action.state };
  if (action.kind === 'clear') return { state: null };
  if (!holder.state) return holder;
  const next = reduceDelve(holder.state, action.command);
  return next === holder.state ? holder : { state: next };
}

export function DelveRun(props: DelveRunProps) {
  const [{ state }, dispatch] = useReducer(holderReducer, { state: null });
  const [vault, setVault] = useState<string[]>(() => props.vaultItemIds.slice());
  const reported = useRef<{ runId: string; count: number }>({ runId: '', count: 0 });
  const clearedRuns = useRef<Set<string>>(new Set());
  const [checkpoint, setCheckpoint] = useState<string | null>(null);

  useEffect(() => {
    setVault((current) => {
      const merged = current.slice();
      for (const id of props.vaultItemIds) if (!merged.includes(id)) merged.push(id);
      return merged;
    });
  }, [props.vaultItemIds]);

  // Report each new drop exactly once, in order, so the vault keeps it even if the run is lost.
  useEffect(() => {
    if (!state) return;
    if (reported.current.runId !== state.runId) reported.current = { runId: state.runId, count: 0 };
    while (reported.current.count < state.found.length) {
      const index = reported.current.count;
      const itemId = state.found[index];
      reported.current.count += 1;
      props.onLoot(state.runId, index, itemId);
      setVault((current) => (current.includes(itemId) ? current : [...current, itemId]));
    }
  }, [state, props]);

  const currentRun = useRef<string | null>(null);
  currentRun.current = state?.runId ?? null;
  useEffect(() => {
    if (!state || state.phase !== 'floor-clear' || clearedRuns.current.has(state.runId)) return;
    const runId = state.runId;
    clearedRuns.current.add(runId);
    setCheckpoint('Saving checkpoint…');
    props.onFloorCleared(runId, state.floor).then((message) => {
      if (currentRun.current === runId) setCheckpoint(message);
    }, () => {
      if (currentRun.current === runId) setCheckpoint('Checkpoint could not be saved this time.');
    });
  }, [state, props]);

  const start = (allocated: Attributes) => {
    setCheckpoint(null);
    dispatch({
      kind: 'start',
      state: createDelve({ runId: newRunId(), seed: newSeed(), level: props.level, allocated, vaultItemIds: vault }),
    });
  };
  const send = (command: DelveCommand) => dispatch({ kind: 'command', command });

  if (!state) {
    return (
      <Camp
        level={props.level}
        savedAttributes={props.savedAttributes}
        vault={vault}
        keepNote={props.keepNote}
        exitHref={props.exitHref}
        onSave={props.onSaveAttributes}
        onStart={start}
      />
    );
  }

  return (
    <main className="wrap delve" aria-label="Forgotten Crypt delve">
      <RunHeader state={state} exitHref={props.exitHref} onCamp={() => dispatch({ kind: 'clear' })} />
      {state.phase === 'map' ? <MapView state={state} onChoose={(index) => send({ type: 'choose-room', row: state.row, index })} /> : null}
      {state.phase === 'combat' && state.battle ? <CombatScreen state={state} battle={state.battle} send={send} /> : null}
      {state.phase === 'reward' && state.reward ? <RewardView state={state} send={send} /> : null}
      {state.phase === 'event' && state.event ? <EventView state={state} send={send} /> : null}
      {state.phase === 'treasure' ? <TreasureView state={state} send={send} /> : null}
      {state.phase === 'rest' ? <RestView state={state} send={send} /> : null}
      {state.phase === 'floor-clear' ? (
        <EndView state={state} won checkpoint={checkpoint} onCamp={() => dispatch({ kind: 'clear' })} exitHref={props.exitHref} />
      ) : null}
      {state.phase === 'defeat' ? (
        <EndView state={state} won={false} checkpoint={null} onCamp={() => dispatch({ kind: 'clear' })} exitHref={props.exitHref} />
      ) : null}
    </main>
  );
}

/* ---------- Camp: allocate stats, see gear, start ---------- */

function Camp(props: {
  level: number; savedAttributes: Attributes; vault: readonly string[]; keepNote: string; exitHref: string;
  onSave: (attributes: Attributes) => Promise<boolean>; onStart: (attributes: Attributes) => void;
}) {
  const [draft, setDraft] = useState<Attributes>(() => clampAllocation(props.savedAttributes, props.level));
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(clampAllocation(props.savedAttributes, props.level)), [props.savedAttributes, props.level]);

  const total = pointsForLevel(props.level);
  const left = total - spentPoints(draft);
  const loadout = useMemo(() => bestLoadout(props.vault), [props.vault]);
  const preview = effectiveAttributes({ allocated: draft, runBonus: ZERO_ATTRIBUTES, loadout });

  const save = async () => {
    setSaving(true);
    setSaveNote(null);
    try {
      const ok = await props.onSave(draft);
      setSaveNote(ok ? 'Build saved.' : 'Build kept for this visit only.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="wrap delve" aria-label="Forgotten Crypt camp">
      <div className="delve-top">
        <a className="btn ghost delve-leave" href={props.exitHref}>← Back</a>
        <h1 className="delve-title">Forgotten Crypt</h1>
      </div>
      <p className="muted">
        Floor 1 of 5 · Shattered Vale. Pick a path, fight with cards, find gear, beat the Hollow Warden.
      </p>

      <section className="delve-panel delve-camp-hero">
        <div className="delve-hero-sprite"><HeroSprite loadout={loadout} label="Your adventurer with Crypt gear" /></div>
        <div>
          <p className="delve-level">Level {props.level}</p>
          <p className="muted delve-small">Only real quests level you up. Each level gives 3 more points.</p>
          <p className="delve-small">Max HP {maxHpFor(preview, props.level)} · Crit {Math.round(critChance(preview) * 100)}% · Dodge {Math.round(dodgeChance(preview) * 100)}%</p>
        </div>
      </section>

      <section className="delve-panel" aria-labelledby="delve-attr-title">
        <h2 id="delve-attr-title">Attributes <span className="delve-points">{left} of {total} points left</span></h2>
        <ul className="delve-attrs">
          {ATTRIBUTE_KEYS.map((key) => {
            const info = ATTRIBUTE_INFO[key];
            const gear = preview[key] - draft[key];
            return (
              <li key={key} className="delve-attr">
                <div className="delve-attr-text">
                  <strong>{info.label}</strong> <span className="delve-attr-value">{draft[key]}{gear > 0 ? <span className="delve-gear-bonus"> +{gear}</span> : null}</span>
                  <span className="muted delve-small">{info.effect}</span>
                </div>
                <div className="delve-stepper">
                  <button type="button" className="btn ghost" aria-label={`Lower ${info.label}`} disabled={draft[key] <= 0}
                    onClick={() => setDraft(adjustAttribute(draft, key, -1, props.level))}>−</button>
                  <button type="button" className="btn ghost" aria-label={`Raise ${info.label}`} disabled={left <= 0}
                    onClick={() => setDraft(adjustAttribute(draft, key, 1, props.level))}>+</button>
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn ghost" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save build'}</button>
        {saveNote ? <p className="delve-small" role="status">{saveNote}</p> : null}
      </section>

      <section className="delve-panel" aria-labelledby="delve-vault-title">
        <h2 id="delve-vault-title">Gear vault</h2>
        {props.vault.length === 0 ? (
          <p className="muted delve-small">No gear yet. Monsters, chests and the boss drop it.</p>
        ) : (
          <ul className="delve-vault">
            {props.vault.map((id) => {
              const entry = lootById(id);
              if (!entry) return null;
              const worn = loadout[entry.slot] === id;
              return (
                <li key={id} className={`delve-loot rarity-${entry.rarity}`}>
                  <strong>{entry.name}</strong> <span className="delve-small">{bonusLabel(entry)}</span>
                  {entry.earnedOnly ? <span className="soon-pill">Quest-earned</span> : null}
                  {worn ? <span className="soon-pill">Worn</span> : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted delve-small">{props.keepNote}</p>
      </section>

      <button type="button" className="btn delve-start" onClick={() => props.onStart(draft)}>Enter Floor 1</button>
      <p className="muted delve-small">Runs save only between floors. Leaving mid-floor ends the run, but gear you found is kept.</p>
    </main>
  );
}

/* ---------- Shared pieces ---------- */

function HeroSprite({ loadout, label }: { loadout: Loadout; label?: string }) {
  return <AdventurerSprite label={label} overlays={gearOverlays(loadout)} palette={HERO_PALETTE} />;
}

function MonsterSprite({ sprite, label }: { sprite: keyof typeof MONSTER_SPRITES; label: string }) {
  const rows = MONSTER_SPRITES[sprite];
  const width = rows[0]?.length ?? 16;
  const rects = [];
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const fill = MONSTER_PALETTE[rows[y][x]];
      if (fill) rects.push(<rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    }
  }
  return (
    <svg className="pixel-sprite delve-monster-svg" viewBox={`0 0 ${width} ${rows.length}`} role="img" aria-label={label}
      shapeRendering="crispEdges">
      {rects}
    </svg>
  );
}

function HpBar({ hp, max, label, block }: { hp: number; max: number; label: string; block?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((hp / max) * 100))) : 0;
  return (
    <div className="delve-hp" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
      <div className="delve-hp-fill" style={{ width: `${pct}%` }} />
      <span className="delve-hp-text">{hp}/{max}{block ? ` · 🛡 ${block}` : ''}</span>
    </div>
  );
}

function RunHeader({ state, exitHref, onCamp }: { state: DelveState; exitHref: string; onCamp: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const over = state.phase === 'defeat' || state.phase === 'floor-clear';
  const step = Math.min(state.row + 1, FLOOR_ROWS + 1);
  return (
    <header className="delve-header">
      <div className="delve-top">
        <div className="delve-heading">
          <p className="delve-floor">{FLOOR_NAME}</p>
          <p className="muted delve-small">{state.row >= FLOOR_ROWS ? 'Boss chamber' : `Room ${step} of ${FLOOR_ROWS}`} · Deck {state.deck.length} · Gear found {state.found.length}</p>
        </div>
        {over ? null : confirm ? (
          <span className="delve-confirm">
            <a className="btn confirm-armed delve-leave" href={exitHref} onClick={onCamp}>End run</a>
            <button type="button" className="btn ghost delve-leave" onClick={() => setConfirm(false)}>Stay</button>
          </span>
        ) : (
          <button type="button" className="btn ghost delve-leave" onClick={() => setConfirm(true)}>Leave</button>
        )}
      </div>
      {confirm && !over ? <p className="delve-small" role="alert">Leaving ends this run. Gear you found stays in your vault.</p> : null}
      {state.phase !== 'combat' ? <HpBar hp={state.hp} max={state.maxHp} label="Your HP" /> : null}
    </header>
  );
}

/* ---------- Map ---------- */

const ROOM_GLYPH: Record<Room['kind'], string> = { fight: '⚔', elite: '☠', treasure: '◆', event: '?', rest: '🔥' };

function MapView({ state, onChoose }: { state: DelveState; onChoose: (index: number) => void }) {
  const choices = currentRoomChoices(state);
  const boss = state.row >= FLOOR_ROWS;
  return (
    <section aria-labelledby="delve-map-title">
      {state.note ? <p className="delve-note" role="status">{state.note}</p> : null}
      <h2 id="delve-map-title">{boss ? 'The Hollow Warden waits' : 'Choose your path'}</h2>
      <div className="delve-choices">
        {choices.map((room, index) => (
          <button key={`${state.row}-${index}`} type="button" className={`delve-room room-${room.kind}`} onClick={() => onChoose(index)}>
            <span className="delve-room-glyph" aria-hidden="true">{boss ? '♛' : ROOM_GLYPH[room.kind]}</span>
            <span className="delve-room-text">
              <strong>{boss ? 'Boss' : ROOM_LABEL[room.kind]}: {roomTitle(room)}</strong>
              <span className="delve-small muted">{boss ? 'Beat it to clear the floor and save your checkpoint.' : roomHint(room)}</span>
            </span>
          </button>
        ))}
      </div>
      <ol className="delve-path" aria-label="Floor map">
        {state.rows.map((row, r) => (
          <li key={r} className={r < state.row ? 'done' : r === state.row ? 'now' : 'later'}>
            {row.map((room, i) => (
              <span key={i} className={r < state.row && state.path[r] === i ? 'taken' : ''} title={ROOM_LABEL[room.kind]}>
                {ROOM_GLYPH[room.kind]}
              </span>
            ))}
          </li>
        ))}
        <li className={boss ? 'now' : 'later'}><span>♛</span></li>
      </ol>
    </section>
  );
}

/* ---------- Combat ---------- */

function CombatScreen({ state, battle, send }: { state: DelveState; battle: Battle; send: (command: DelveCommand) => void }) {
  const foe = battle.foe;
  const intent = foeIntent(battle);
  const fb = battle.feedback;
  const lastLog = battle.log.slice(-3);
  const typeLabel = TYPE_LABEL[foe.type];
  const weakTo = weaknessesOf(foe.type).map((element) => ELEMENT_LABEL[element]).join('/');
  const resists = resistancesOf(foe.type).map((element) => ELEMENT_LABEL[element]).join('/');
  const intentClass = intent.kind === 'attack' ? 'attack' : intent.kind === 'guard' ? 'guard' : 'roar';
  return (
    <section className="delve-combat" aria-label={`Fight: ${foe.name}`}>
      <div className={`delve-foe rank-${foe.rank}`}>
        <div className="delve-foe-info">
          <p className="delve-foe-name">{foe.name} <span className={`delve-type type-${foe.type}`}>{typeLabel}</span></p>
          <HpBar hp={foe.hp} max={foe.maxHp} label={`${foe.name} HP`} block={foe.block} />
          <p className="delve-small muted">
            Weak to {weakTo}{resists ? ` · Resists ${resists}` : ''}
            {foe.vulnerable > 0 ? ` · Exposed ${foe.vulnerable}` : ''}{foe.weak > 0 ? ` · Weakened ${foe.weak}` : ''}
            {foe.poison > 0 ? ` · Poison ${foe.poison}` : ''}{foe.strength > 0 ? ` · Rage +${foe.strength}` : ''}
            {battle.enraged ? ' · ENRAGED' : ''}
          </p>
          <p className={`delve-intent intent-${intentClass}`} aria-label={`Next move: ${intentText(battle)}`}>
            Next: <strong>{intentText(battle)}</strong>
          </p>
        </div>
        <div className="delve-monster" key={`foe-${fb.seq}`}>
          <MonsterSprite sprite={foe.sprite} label={foe.name} />
          {fb.dealt !== null ? (
            <span className={`delve-pop pop-dealt${fb.crit ? ' crit' : ''}`} aria-hidden="true">
              −{fb.dealt}{fb.crit ? '!' : ''}{fb.effect === 'super' ? ' ★' : ''}
            </span>
          ) : null}
        </div>
      </div>

      <div className="delve-hero">
        <div className="delve-hero-sprite small" key={`hero-${fb.seq}`}>
          <HeroSprite loadout={state.loadout} />
          {fb.taken !== null ? <span className="delve-pop pop-taken" aria-hidden="true">−{fb.taken}</span> : null}
          {fb.healed ? <span className="delve-pop pop-heal" aria-hidden="true">+{fb.healed}</span> : null}
        </div>
        <div className="delve-hero-info">
          <HpBar hp={battle.hp} max={battle.maxHp} label="Your HP" block={battle.block} />
          <p className="delve-energy" aria-label={`Energy ${battle.energy} of ${ENERGY_PER_TURN}`}>
            {[0, 1, 2].map((i) => <span key={i} className={i < battle.energy ? 'on' : ''} aria-hidden="true">◆</span>)}
            {battle.energy > ENERGY_PER_TURN ? <span className="on" aria-hidden="true">+{battle.energy - ENERGY_PER_TURN}</span> : null}
            <span className="delve-small muted"> Turn {battle.turn} · Draw {battle.drawPile.length} · Discard {battle.discard.length}</span>
          </p>
          {battle.focused ? <p className="delve-small delve-focus">Focused: next attack ×2</p> : null}
          {battle.might > 0 || battle.dodgeNext || battle.critNext ? (
            <p className="delve-small delve-focus">
              {[battle.might > 0 ? `Attacks +${battle.might}` : '', battle.dodgeNext ? 'Dodge ready' : '', battle.critNext ? 'Next hit crits' : '']
                .filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="delve-log" role="log" aria-live="polite">
        {lastLog.map((line, i) => <p key={`${battle.log.length}-${i}`} className="delve-small">{line}</p>)}
      </div>

      <div className="delve-hand" role="group" aria-label="Your hand">
        {battle.hand.map((instance) => (
          <CardButton key={instance.uid} id={instance.id} battle={battle} disabled={!canPlay(battle, instance.uid)}
            onPlay={() => send({ type: 'play', uid: instance.uid })} />
        ))}
        {battle.hand.length === 0 ? <p className="muted delve-small">No cards left. End your turn.</p> : null}
      </div>
      <button type="button" className="btn delve-end-turn" onClick={() => send({ type: 'end-turn' })}>
        End turn
      </button>
    </section>
  );
}

function CardButton({ id, battle, disabled, onPlay }: { id: CardId; battle: Battle; disabled: boolean; onPlay: () => void }) {
  const def = CARDS[id];
  const intent = foeIntent(battle);
  let damage = previewDamage(battle, id);
  if (def.counter !== undefined && !def.damage && intent.kind !== 'attack') damage = null;
  const effect = def.element ? effectiveness(def.element, battle.foe.type) : 'normal';
  const hits = def.hits && def.hits > 1 ? `×${def.hits}` : '';
  return (
    <button type="button" className={`delve-card kind-${def.kind}${def.element ? ` el-${def.element}` : ''}`} disabled={disabled} onClick={onPlay}
      aria-label={`${def.name}, costs ${def.cost}. ${def.text}${damage !== null ? ` Deals ${damage}${hits} now.` : ''}`}>
      <span className="delve-card-cost" aria-hidden="true">{def.cost}</span>
      <span className="delve-card-name">{def.name}</span>
      <span className="delve-card-text">{def.text}</span>
      {damage !== null ? (
        <span className={`delve-card-dmg eff-${effect}`}>
          {damage}{hits}{effect === 'super' ? ' ★' : effect === 'resisted' ? ' ↓' : ''}
        </span>
      ) : null}
    </button>
  );
}

/* ---------- After-room screens ---------- */

function LootLine({ itemId, equipped }: { itemId: string | null; equipped: boolean }) {
  if (!itemId) return null;
  const entry = lootById(itemId);
  if (!entry) return null;
  return (
    <div className={`delve-loot-drop rarity-${entry.rarity}`} role="status">
      <p><strong>{RARITY_LABEL[entry.rarity]} gear: {entry.name}</strong> · {bonusLabel(entry)}</p>
      <p className="delve-small muted">{entry.flavor} {equipped ? 'Equipped — look at your adventurer.' : 'Sent to your vault.'}</p>
    </div>
  );
}

function RewardView({ state, send }: { state: DelveState; send: (command: DelveCommand) => void }) {
  const reward = state.reward;
  if (!reward) return null;
  return (
    <section aria-labelledby="delve-reward-title">
      <h2 id="delve-reward-title">Victory!</h2>
      <LootLine itemId={reward.loot} equipped={reward.equipped} />
      <p>Add one card to your deck:</p>
      <div className="delve-hand">
        {reward.cards.map((id) => {
          const def = CARDS[id];
          return (
            <button key={id} type="button" className={`delve-card kind-${def.kind}${def.element ? ` el-${def.element}` : ''}`}
              onClick={() => send({ type: 'pick-card', cardId: id })}>
              <span className="delve-card-cost" aria-hidden="true">{def.cost}</span>
              <span className="delve-card-name">{def.name}</span>
              <span className="delve-card-text">{def.text}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn ghost" onClick={() => send({ type: 'pick-card', cardId: null })}>Skip card</button>
    </section>
  );
}

function EventView({ state, send }: { state: DelveState; send: (command: DelveCommand) => void }) {
  const ev = state.event;
  if (!ev) return null;
  const def = eventById(ev.eventId);
  const attrs = effectiveAttributes(state);
  return (
    <section aria-labelledby="delve-event-title">
      <h2 id="delve-event-title">{def.title}</h2>
      <p>{def.prose}</p>
      {ev.outcome === null ? (
        <div className="delve-options">
          {def.options.map((option) => (
            <button key={option.id} type="button" className="btn ghost delve-option" onClick={() => send({ type: 'event-option', optionId: option.id })}>
              {option.label}
              {option.check ? (
                <span className="delve-small muted"> · {ATTRIBUTE_INFO[option.check].short} check {Math.round(checkChance(attrs[option.check]) * 100)}%</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="delve-note" role="status">{ev.outcome}</p>
          {state.reward ? <LootLine itemId={state.reward.loot} equipped={state.reward.equipped} /> : null}
          <button type="button" className="btn" onClick={() => send({ type: 'continue' })}>Continue</button>
        </>
      )}
    </section>
  );
}

function TreasureView({ state, send }: { state: DelveState; send: (command: DelveCommand) => void }) {
  return (
    <section aria-labelledby="delve-treasure-title">
      <h2 id="delve-treasure-title">Old chest</h2>
      <div className="delve-hero-sprite"><HeroSprite loadout={state.loadout} label="Your adventurer" /></div>
      <LootLine itemId={state.reward?.loot ?? null} equipped={state.reward?.equipped ?? false} />
      <button type="button" className="btn" onClick={() => send({ type: 'continue' })}>Continue</button>
    </section>
  );
}

function RestView({ state, send }: { state: DelveState; send: (command: DelveCommand) => void }) {
  const canTrim = state.deck.length > 6 && (state.deck.includes('strike') || state.deck.includes('guard'));
  return (
    <section aria-labelledby="delve-rest-title">
      <h2 id="delve-rest-title">Campfire</h2>
      <p>The fire is low but warm. Choose one.</p>
      <div className="delve-options">
        <button type="button" className="btn" onClick={() => send({ type: 'rest', choice: 'heal' })}>Rest (heal 35%)</button>
        <button type="button" className="btn ghost" disabled={!canTrim} onClick={() => send({ type: 'rest', choice: 'trim' })}>
          Sharpen your deck (remove a Strike or Guard)
        </button>
      </div>
    </section>
  );
}

function EndView({ state, won, checkpoint, onCamp, exitHref }: {
  state: DelveState; won: boolean; checkpoint: string | null; onCamp: () => void; exitHref: string;
}) {
  return (
    <section aria-labelledby="delve-end-title" className={`delve-end ${won ? 'won' : 'lost'}`}>
      <h2 id="delve-end-title">{won ? 'Floor 1 cleared!' : 'You fell in the Crypt'}</h2>
      <div className="delve-hero-sprite"><HeroSprite loadout={state.loadout} label="Your adventurer" /></div>
      {won ? (
        <>
          <p>The Hollow Warden crumbles. Floors 2–5 of the Forgotten Crypt open in a later update.</p>
          {state.reward ? <LootLine itemId={state.reward.loot} equipped={state.reward.equipped} /> : null}
          {checkpoint ? <p className="delve-note" role="status">{checkpoint}</p> : null}
        </>
      ) : (
        <p>The run is over. You keep every piece of gear you found.</p>
      )}
      <p className="delve-small">Gear found this run: {state.found.length === 0 ? 'none' : state.found.map((id) => lootById(id)?.name ?? id).join(', ')}</p>
      <div className="delve-options">
        <button type="button" className="btn" onClick={onCamp}>Back to camp</button>
        <a className="btn ghost" href={exitHref}>Leave the Crypt</a>
      </div>
    </section>
  );
}

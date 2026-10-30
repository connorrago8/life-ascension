'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AdventurerSprite } from '../AdventurerSprite';
import { PALETTE } from '../spriteArt';
import {
  bigHitComing, canPlay, cardCritChance, comboReady, ENERGY_PER_TURN, foeIntent, incomingDamage, INTENT_ICON, intentText,
  PASSIVE_TEXT, previewDamage, previewHits, upcomingIntent, describeIntent, WORN_DOWN_PER_END, WORN_DOWN_TURN, type Battle, type Proc,
} from '../../lib/crypt/delve/battle';
import {
  CARDS, cardDef, COMBO_AT, comboBonus, effectiveness, ELEMENT_LABEL, isUpgraded, resistancesOf, TYPE_LABEL, upgradeDef, weaknessesOf,
  type CardDef, type DeckCard,
} from '../../lib/crypt/delve/cards';
import { checkChance, eventById, FLOOR_NAME, FLOOR_ROWS, roomHint, roomTitle, ROOM_LABEL, type Room } from '../../lib/crypt/delve/floor';
import { GEAR_INKS, gearOverlays, wornGearLabels } from '../../lib/crypt/delve/gearArt';
import { bonusLabel, lootById, passiveLabel, RARITY_LABEL, type Loadout } from '../../lib/crypt/delve/loot';
import { MONSTER_PALETTE, MONSTER_SPRITES } from '../../lib/crypt/delve/monsterArt';
import { pathOptions, type PathOption } from '../../lib/crypt/delve/pathLabels';
import {
  canRemoveCard, canUpgradeCard, createDelve, currentRoomChoices, effectiveAttributes, reduceDelve, runLoadout, type DelveCommand,
  type DelveState,
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

  const start = (allocated: Attributes, wear: readonly string[]) => {
    setCheckpoint(null);
    dispatch({
      kind: 'start',
      // Worn gear is chosen fresh at camp for each run; nothing worn carries over.
      state: createDelve({ runId: newRunId(), seed: newSeed(), level: props.level, allocated, vaultItemIds: vault, wear }),
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
      {state.phase === 'start-pick' ? <StartPickView state={state} send={send} /> : null}
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
  onSave: (attributes: Attributes) => Promise<boolean>; onStart: (attributes: Attributes, wear: readonly string[]) => void;
}) {
  const [draft, setDraft] = useState<Attributes>(() => clampAllocation(props.savedAttributes, props.level));
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(clampAllocation(props.savedAttributes, props.level)), [props.savedAttributes, props.level]);

  const total = pointsForLevel(props.level);
  const left = total - spentPoints(draft);
  // Crypt-run gear only (not /character account equipment). Camp mounts fresh after
  // every run end, defeat or leave, so this always starts empty: nothing is worn
  // until the player taps Wear again. It is never stored locally or on the server.
  const [wear, setWear] = useState<string[]>([]);
  const loadout = useMemo(() => runLoadout(props.vault, wear), [props.vault, wear]);
  const toggleWear = (id: string) => {
    const entry = lootById(id);
    if (!entry) return;
    setWear((current) => current.includes(id)
      ? current.filter((other) => other !== id)
      : [...current.filter((other) => lootById(other)?.slot !== entry.slot), id]);
  };
  const enter = (
    <div className="delve-start-block">
      <button type="button" className="btn delve-start" onClick={() => props.onStart(draft, Object.values(loadout) as string[])}>Enter Floor 1</button>
      <p className="muted delve-small">Runs save only between floors. Leaving mid-floor ends the run, but gear you found is kept.</p>
    </div>
  );
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
          <p className="delve-small delve-worn">Wearing {wornGearLabels(loadout).join(' · ')}</p>
          <p className="delve-small">Max HP {maxHpFor(preview, props.level)} · Crit {Math.round(critChance(preview) * 100)}% · Dodge {Math.round(dodgeChance(preview) * 100)}%</p>
        </div>
      </section>

      {enter}

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
        <p className="muted delve-small">Tap Wear to bring gear on this run. Worn gear resets after every run.</p>
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
                  {passiveLabel(entry) ? <span className="delve-small delve-passive">✦ {passiveLabel(entry)}</span> : null}
                  {entry.earnedOnly ? <span className="soon-pill">Quest-earned</span> : null}
                  {worn ? <span className="soon-pill">Worn</span> : null}
                  <button type="button" className="btn ghost delve-wear" aria-pressed={worn}
                    aria-label={worn ? `Take off ${entry.name}` : `Wear ${entry.name} this run`}
                    onClick={() => toggleWear(id)}>{worn ? 'Take off' : 'Wear'}</button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted delve-small">{props.keepNote}</p>
      </section>

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
  const options = pathOptions(choices, boss);
  // Which option is highlighted on both the list and the map. Display only:
  // entering a room still happens only from the list button below.
  const [active, setActive] = useState<{ row: number; index: number } | null>(null);
  const activeIndex = active && active.row === state.row ? active.index : null;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const highlight = (index: number) => setActive({ row: state.row, index });
  const showOnList = (index: number) => {
    highlight(index);
    const button = buttons.current[index];
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest' });
  };
  const node = (option: PathOption, glyph: string) => (
    <button key={option.index} type="button" data-path={option.badge}
      className={`delve-node path-${option.badge.toLowerCase()}${activeIndex === option.index ? ' active' : ''}`}
      aria-label={`Show on list: ${option.ariaLabel}`} aria-pressed={activeIndex === option.index}
      onClick={() => showOnList(option.index)}>
      <span className="delve-node-dot" aria-hidden="true">
        <span className="delve-node-glyph">{glyph}</span>
        <span className="delve-badge">{option.badge}</span>
      </span>
      <span className="delve-node-label" aria-hidden="true">{option.short}</span>
    </button>
  );
  return (
    <section aria-labelledby="delve-map-title">
      {state.note ? <p className="delve-note" role="status">{state.note}</p> : null}
      <h2 id="delve-map-title">{boss ? 'The Hollow Warden waits' : 'Choose your path'}</h2>
      <div className="delve-choices">
        {options.map((option) => {
          const room = choices[option.index];
          return (
            <button key={`${state.row}-${option.index}`} type="button" ref={(el) => { buttons.current[option.index] = el; }}
              data-path={option.badge} aria-label={option.ariaLabel} aria-describedby={`delve-hint-${option.index}`}
              className={`delve-room room-${room.kind} path-${option.badge.toLowerCase()}${activeIndex === option.index ? ' active' : ''}`}
              onFocus={() => highlight(option.index)} onPointerEnter={() => highlight(option.index)}
              onClick={() => onChoose(option.index)}>
              <span className="delve-badge" aria-hidden="true">{option.badge}</span>
              <span className="delve-room-glyph" aria-hidden="true">{boss ? '♛' : ROOM_GLYPH[room.kind]}</span>
              <span className="delve-room-text">
                <strong>{option.kind}: {option.title}</strong>
                <span id={`delve-hint-${option.index}`} className="delve-small muted">{boss ? 'Beat it to clear the floor and save your checkpoint.' : roomHint(room)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="delve-small muted delve-map-help">Letters match the map. Tap a room on the list to enter it.</p>
      <ol className="delve-path" aria-label="Floor map">
        {state.rows.map((row, r) => (
          r === state.row && !boss ? (
            <li key={r} className="now reachable">{options.map((option) => node(option, ROOM_GLYPH[row[option.index].kind]))}</li>
          ) : (
            <li key={r} className={r < state.row ? 'done' : 'later'}>
              {row.map((room, i) => (
                <span key={i} className={r < state.row && state.path[r] === i ? 'taken' : ''} title={ROOM_LABEL[room.kind]}>
                  {ROOM_GLYPH[room.kind]}
                </span>
              ))}
            </li>
          )
        ))}
        {boss ? <li className="now reachable">{options.map((option) => node(option, '♛'))}</li> : <li className="later"><span>♛</span></li>}
      </ol>
    </section>
  );
}

/* ---------- Combat ---------- */

/** Tap-to-explain status chips. Short, readable on a phone. */
type Chip = { key: string; icon: string; label: string; explain: string };

const STATUS_HELP = {
  block: 'Block soaks damage, then resets at the start of your turn.',
  exposed: 'Exposed: takes 50% more damage from attacks.',
  weak: 'Weakened: its attacks deal 25% less.',
  burn: 'Burn: takes Burn damage at the start of its turn, then Burn −1. (INT)',
  bleed: 'Bleed: loses Bleed HP at the start of every turn, for the whole fight. (STR)',
  rage: 'Rage: every attack hits this much harder.',
  hexed: 'Hexed: your attacks deal 25% less this turn.',
  thorns: 'Thorns: each enemy hit on you deals this much back. (END)',
  retain: 'Entrenched: your Block is kept into next turn. (END)',
  haste: 'Haste: extra energy next turn. (AGI)',
  combo: `Combo: your ${COMBO_AT}rd card each turn gets bonus damage or Block. (AGI)`,
  crit: 'Crit: chance for an attack hit to deal double. (LCK)',
  dodge: 'Dodge ready: the next enemy hit misses.',
  focus: 'Focused: your next attack deals double.',
  loaded: 'Loaded Dice: your next attack hit is a crit (double damage).',
  might: 'Might: every attack hit deals extra damage this fight.',
  worn: 'Steady pressure: from turn 2, if your cards deal less than this in a turn, the foe is worn down by the rest as its turn starts. (END)',
} as const;

function ChipRow({ chips, label, open, setOpen }: {
  chips: Chip[]; label: string; open: string | null; setOpen: (key: string | null) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="delve-chips" role="group" aria-label={label}>
      <span className="delve-chips-label delve-small muted">{label}</span>
      {chips.map((chip) => {
        const key = `${label}-${chip.key}`;
        return (
          <button key={key} type="button" className={`delve-chip chip-${chip.key}`} aria-expanded={open === key}
            aria-label={`${chip.label}. ${chip.explain}`} onClick={() => setOpen(open === key ? null : key)}>
            <span aria-hidden="true">{chip.icon}</span> {chip.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One tappable "Statuses" pill (collapsed by default) that expands into the enemy's and
 * your status chips. Each chip still taps to explain itself.
 */
function StatusPanel({ battle }: { battle: Battle }) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const foe = foeChips(battle);
  const hero = heroChips(battle);
  const all = [...foe.map((chip) => ({ ...chip, side: 'Enemy' })), ...hero.map((chip) => ({ ...chip, side: 'You' }))];
  const active = all.find((chip) => `${chip.side}-${chip.key}` === open) ?? null;
  const icons = all.map((chip) => chip.icon).filter((icon, i, list) => list.indexOf(icon) === i).slice(0, 6).join('');
  return (
    <div className="delve-status">
      <button type="button" className="delve-status-pill" aria-expanded={expanded} aria-controls="delve-status-list"
        onClick={() => setExpanded(!expanded)}>
        Statuses <span aria-hidden="true">{icons}</span> <span className="delve-status-count">{all.length}</span>
        <span aria-hidden="true"> {expanded ? '▴' : '▾'}</span>
      </button>
      {expanded ? (
        <div id="delve-status-list" className="delve-status-list">
          <ChipRow chips={foe} label="Enemy" open={open} setOpen={setOpen} />
          <ChipRow chips={hero} label="You" open={open} setOpen={setOpen} />
          {active ? <p className="delve-small delve-explain" role="status">{active.explain}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function foeChips(battle: Battle): Chip[] {
  const foe = battle.foe;
  const chips: Chip[] = [];
  if (foe.block > 0) chips.push({ key: 'block', icon: '🛡', label: `${foe.block}`, explain: STATUS_HELP.block });
  if (foe.vulnerable > 0) chips.push({ key: 'exposed', icon: '🎯', label: `Exposed ${foe.vulnerable}`, explain: STATUS_HELP.exposed });
  if (foe.weak > 0) chips.push({ key: 'weak', icon: '↓', label: `Weak ${foe.weak}`, explain: STATUS_HELP.weak });
  if (foe.burn > 0) chips.push({ key: 'burn', icon: '🔥', label: `Burn ${foe.burn}`, explain: STATUS_HELP.burn });
  if (foe.bleed > 0) chips.push({ key: 'bleed', icon: '🩸', label: `Bleed ${foe.bleed}`, explain: STATUS_HELP.bleed });
  if (foe.strength > 0) chips.push({ key: 'rage', icon: '💪', label: `Rage +${foe.strength}`, explain: STATUS_HELP.rage });
  return chips;
}

function heroChips(battle: Battle): Chip[] {
  const chips: Chip[] = [];
  if (battle.block > 0) chips.push({ key: 'block', icon: '🛡', label: `Block ${battle.block}`, explain: STATUS_HELP.block });
  if (battle.weak > 0) chips.push({ key: 'hexed', icon: '☠', label: 'Hexed', explain: STATUS_HELP.hexed });
  if (battle.thorns > 0) chips.push({ key: 'thorns', icon: '🌵', label: `Thorns ${battle.thorns}`, explain: STATUS_HELP.thorns });
  if (battle.retain) chips.push({ key: 'retain', icon: '🧱', label: 'Keep Block', explain: STATUS_HELP.retain });
  if (battle.haste > 0) chips.push({ key: 'haste', icon: '✨', label: `Haste +${battle.haste} next turn`, explain: STATUS_HELP.haste });
  chips.push({
    key: 'combo', icon: '⛓', label: comboReady(battle) ? `Combo ready +${comboBonus(battle.attributes)}` : `Combo ${Math.min(battle.played, COMBO_AT - 1)}/${COMBO_AT - 1}`,
    explain: STATUS_HELP.combo,
  });
  const crit = Math.round(cardCritChance(battle, CARDS.strike) * 100);
  if (crit > 0 || battle.critNext) chips.push({ key: 'crit', icon: '🍀', label: battle.critNext ? 'Next hit crits' : `Crit ${crit}%`, explain: battle.critNext ? STATUS_HELP.loaded : STATUS_HELP.crit });
  if (battle.dodgeNext) chips.push({ key: 'dodge', icon: '💨', label: 'Dodge ready', explain: STATUS_HELP.dodge });
  if (battle.focused) chips.push({ key: 'focus', icon: '🎯', label: 'Next attack ×2', explain: STATUS_HELP.focus });
  if (battle.might > 0) chips.push({ key: 'might', icon: '⚔', label: `Might +${battle.might}`, explain: STATUS_HELP.might });
  if (battle.turn >= WORN_DOWN_TURN && battle.attributes.endurance > 0) {
    chips.push({ key: 'worn', icon: '⏳', label: `Steady ${Math.floor(battle.attributes.endurance * WORN_DOWN_PER_END)}`, explain: STATUS_HELP.worn });
  }
  for (const passive of battle.passives) {
    chips.push({ key: `gear-${passive}`, icon: '✦', label: 'Gear', explain: PASSIVE_TEXT[passive] });
  }
  return chips;
}

function IntentPanel({ battle }: { battle: Battle }) {
  const intent = foeIntent(battle);
  const then = upcomingIntent(battle);
  const incoming = incomingDamage(battle);
  const telegraph = bigHitComing(battle);
  const kindClass = intent.kind === 'attack' ? 'attack' : intent.kind === 'guard' ? 'guard' : intent.kind === 'charge' ? 'charge' : 'roar';
  return (
    <div className={`delve-intent intent-${kindClass}${telegraph ? ' delve-bighit' : ''}`} aria-label={`Next move: ${intentText(battle)}`}>
      <p className="delve-intent-next">
        <span aria-hidden="true">{INTENT_ICON[intent.kind]} </span>Next: <strong>{intentText(battle)}</strong>
        {incoming ? (
          <span className="delve-incoming">
            {' '}· You take <strong>{incoming.afterBlock}</strong>{incoming.total !== incoming.afterBlock ? ` (${incoming.total} − Block)` : ''}
          </span>
        ) : null}
      </p>
      {telegraph ? (
        <p className="delve-small delve-telegraph" role="status"><span className="delve-bighit-icon" aria-hidden="true">⚠</span> <strong>Big hit next turn:</strong> {describeIntent(then, battle.foe)}. Block up or finish it now.</p>
      ) : (
        <p className="delve-small delve-intent-then">Then: <span aria-hidden="true">{INTENT_ICON[then.kind]} </span>{describeIntent(then, battle.foe)}</p>
      )}
    </div>
  );
}

const PROC_ICON: Record<Proc['kind'], string> = { bleed: '🩸', burn: '🔥', thorns: '🌵', combo: '⛓', worn: '⏳', gear: '✦' };

/** Bleed/Burn/Thorns/Worn-down numbers float off the foe; combo and gear passives flash a small toast. CSS-only, keyed by seq. */
function ProcFloaters({ battle }: { battle: Battle }) {
  const procs = battle.feedback.procs ?? [];
  const floats = procs.filter((proc) => proc.kind !== 'gear' && proc.kind !== 'combo');
  const toasts = procs.filter((proc) => proc.kind === 'gear' || proc.kind === 'combo');
  if (procs.length === 0) return null;
  return (
    <div className="delve-procs" key={`proc-${battle.feedback.seq}`}>
      {floats.map((proc, i) => (
        <span key={`${proc.kind}-${i}`} className={`delve-proc proc-${proc.kind}`} style={{ animationDelay: `${i * 120}ms` }} aria-hidden="true">
          {PROC_ICON[proc.kind]} {proc.text}
        </span>
      ))}
      {toasts.length > 0 ? (
        <p className="delve-proc-toast" role="status">
          {toasts.map((proc, i) => <span key={`${proc.kind}-${i}`} className={`proc-${proc.kind}`}>{PROC_ICON[proc.kind]} {proc.text}</span>)}
        </p>
      ) : null}
    </div>
  );
}

function CombatScreen({ state, battle, send }: { state: DelveState; battle: Battle; send: (command: DelveCommand) => void }) {
  const foe = battle.foe;
  const fb = battle.feedback;
  const lastLog = battle.log.slice(-3);
  const typeLabel = TYPE_LABEL[foe.type];
  const weakTo = weaknessesOf(foe.type).map((element) => ELEMENT_LABEL[element]).join('/');
  const resists = resistancesOf(foe.type).map((element) => ELEMENT_LABEL[element]).join('/');
  return (
    <section className="delve-combat" aria-label={`Fight: ${foe.name}`}>
      <div className={`delve-foe rank-${foe.rank}`}>
        <div className="delve-foe-info">
          <p className="delve-foe-name">{foe.name} <span className={`delve-type type-${foe.type}`}>{typeLabel}</span></p>
          <HpBar hp={foe.hp} max={foe.maxHp} label={`${foe.name} HP`} block={foe.block} />
          <p className="delve-small muted">
            Weak to {weakTo}{resists ? ` · Resists ${resists}` : ''}{battle.enraged ? ' · ENRAGED' : ''}
          </p>
          <IntentPanel battle={battle} />
        </div>
        <div className="delve-monster" key={`foe-${fb.seq}`}>
          <MonsterSprite sprite={foe.sprite} label={foe.name} />
          <ProcFloaters battle={battle} />
          {fb.dealt !== null ? (
            <span className={`delve-pop pop-dealt${fb.crit ? ' crit' : ''}`} aria-hidden="true">
              −{fb.dealt}{fb.crit ? '!' : ''}{fb.effect === 'super' ? ' ★' : ''}
            </span>
          ) : null}
        </div>
      </div>

      <div className="delve-herobar" aria-label="You">
        <div className="delve-hero-sprite tiny" key={`hero-${fb.seq}`}>
          <HeroSprite loadout={state.loadout} />
          {fb.taken !== null ? <span className="delve-pop pop-taken" aria-hidden="true">−{fb.taken}</span> : null}
          {fb.healed ? <span className="delve-pop pop-heal" aria-hidden="true">+{fb.healed}</span> : null}
        </div>
        <div className="delve-herobar-main">
          <HpBar hp={battle.hp} max={battle.maxHp} label="Your HP" block={battle.block} />
          <p className="delve-energy" aria-label={`Energy ${battle.energy} of ${ENERGY_PER_TURN}`}>
            {[0, 1, 2].map((i) => <span key={i} className={i < battle.energy ? 'on' : ''} aria-hidden="true">◆</span>)}
            {battle.energy > ENERGY_PER_TURN ? <span className="on" aria-hidden="true">+{battle.energy - ENERGY_PER_TURN}</span> : null}
            <span className="delve-small muted"> Turn {battle.turn} · Draw {battle.drawPile.length} · Discard {battle.discard.length}</span>
          </p>
        </div>
      </div>
      <StatusPanel battle={battle} />

      {/* Turn log for screen readers only; buffs show as chips under Statuses instead of a floating line. */}
      <div className="delve-log sr-only" role="log" aria-live="polite">
        {lastLog.map((line, i) => <p key={`${battle.log.length}-${i}`}>{line}</p>)}
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

function CardFace({ def, upgraded }: { def: CardDef; upgraded?: boolean }) {
  return (
    <>
      <span className="delve-card-cost" aria-hidden="true">{def.cost}</span>
      <span className={`delve-card-name${upgraded ? ' upgraded' : ''}`}>{def.name}</span>
      <span className="delve-card-text">{def.text}</span>
    </>
  );
}

function CardButton({ id, battle, disabled, onPlay }: { id: DeckCard; battle: Battle; disabled: boolean; onPlay: () => void }) {
  const def = cardDef(id);
  const intent = foeIntent(battle);
  let damage = previewDamage(battle, id);
  if (def.counter !== undefined && !def.damage && intent.kind !== 'attack') damage = null;
  const effect = def.element ? effectiveness(def.element, battle.foe.type) : 'normal';
  const count = previewHits(battle, id);
  const hits = count > 1 ? `×${count}` : '';
  const combo = comboReady(battle) && (damage !== null || !!def.block);
  return (
    <button type="button" className={`delve-card kind-${def.kind}${def.element ? ` el-${def.element}` : ''}${combo ? ' combo' : ''}`} disabled={disabled} onClick={onPlay}
      aria-label={`${def.name}, costs ${def.cost}. ${def.text}${damage !== null ? ` Deals ${damage}${hits} now.` : ''}${damage !== null && effect === 'super' ? ' Super effective.' : ''}${damage !== null && effect === 'resisted' ? ' Resisted.' : ''}${combo ? ' Combo bonus.' : ''}`}>
      <CardFace def={def} upgraded={isUpgraded(id)} />
      {combo ? <span className="delve-card-mark" aria-hidden="true" title="Combo bonus">⛓</span> : null}
      {damage !== null ? (
        <span className={`delve-card-dmg eff-${effect}`}>
          <span className="delve-dmg-num">{damage}{hits}</span>
          {effect !== 'normal' ? <sup className="delve-dmg-eff" aria-hidden="true" title={effect === 'super' ? 'Super effective' : 'Resisted'}>{effect === 'super' ? '↑' : '↓'}</sup> : null}
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
      {passiveLabel(entry) ? <p className="delve-small delve-passive">✦ {passiveLabel(entry)}</p> : null}
      <p className="delve-small muted">{entry.flavor} {equipped ? 'Equipped — look at your adventurer.' : 'Sent to your vault.'}</p>
    </div>
  );
}

function StartPickView({ state, send }: { state: DelveState; send: (command: DelveCommand) => void }) {
  return (
    <section aria-labelledby="delve-start-title">
      <h2 id="delve-start-title">Choose your opening card</h2>
      <p>Pick 1 of 2 to add to your deck for this run.</p>
      <div className="delve-hand delve-start-pick">
        {state.startPick.map((id) => {
          const def = CARDS[id];
          return (
            <button key={id} type="button" className={`delve-card kind-${def.kind}${def.element ? ` el-${def.element}` : ''}`}
              onClick={() => send({ type: 'pick-start', cardId: id })} aria-label={`Take ${def.name}, costs ${def.cost}. ${def.text}`}>
              <CardFace def={def} />
            </button>
          );
        })}
      </div>
    </section>
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
              <CardFace def={def} />
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
          <UpgradePicker state={state} send={send} />
          <button type="button" className="btn" onClick={() => send({ type: 'continue' })}>Continue</button>
        </>
      )}
    </section>
  );
}

/** Pick one card to upgrade into its "+" version. */
function UpgradePicker({ state, send }: { state: DelveState; send: (command: DelveCommand) => void }) {
  if (state.upgrades <= 0) {
    return state.note && (state.phase === 'treasure' || state.phase === 'event') && state.note.includes('Upgraded')
      ? <p className="delve-note" role="status">{state.note}</p> : null;
  }
  return (
    <div className="delve-upgrade" aria-labelledby="delve-upgrade-title">
      <h3 id="delve-upgrade-title">Upgrade a card</h3>
      <p className="delve-small muted">Pick one card to make stronger for this run (it gets a “+”).</p>
      <div className="delve-deck-list">
        {state.deck.map((key, index) => {
          if (!canUpgradeCard(state, index)) return null;
          const next = upgradeDef(CARDS[key as keyof typeof CARDS]);
          return (
            <button key={`${key}-${index}`} type="button" className="btn ghost delve-deck-card"
              aria-label={`Upgrade ${cardDef(key).name} to ${next.name}. ${next.text}`}
              onClick={() => send({ type: 'upgrade-card', index })}>
              <strong>{cardDef(key).name} → {next.name}</strong>
              <span className="delve-small muted">{next.text.split(' Upgraded: ')[1] ?? ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TreasureView({ state, send }: { state: DelveState; send: (command: DelveCommand) => void }) {
  return (
    <section aria-labelledby="delve-treasure-title">
      <h2 id="delve-treasure-title">Old chest</h2>
      <div className="delve-hero-sprite"><HeroSprite loadout={state.loadout} label="Your adventurer" /></div>
      <LootLine itemId={state.reward?.loot ?? null} equipped={state.reward?.equipped ?? false} />
      <UpgradePicker state={state} send={send} />
      <button type="button" className="btn" onClick={() => send({ type: 'continue' })}>{state.upgrades > 0 ? 'Skip upgrade' : 'Continue'}</button>
    </section>
  );
}

function RestView({ state, send }: { state: DelveState; send: (command: DelveCommand) => void }) {
  const [removing, setRemoving] = useState(false);
  const canRemove = canRemoveCard(state);
  return (
    <section aria-labelledby="delve-rest-title">
      <h2 id="delve-rest-title">Campfire</h2>
      <p>The fire is low but warm. Choose one: heal, or remove a card.</p>
      {removing ? (
        <div className="delve-upgrade">
          <h3>Remove which card?</h3>
          <div className="delve-deck-list">
            {state.deck.map((key, index) => (
              <button key={`${key}-${index}`} type="button" className="btn ghost delve-deck-card"
                aria-label={`Remove ${cardDef(key).name}`} onClick={() => send({ type: 'rest', choice: 'remove', index })}>
                <strong>{cardDef(key).name}</strong>
                <span className="delve-small muted">{cardDef(key).cost} energy · {CARDS[cardDef(key).id].text}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn ghost" onClick={() => setRemoving(false)}>Back</button>
        </div>
      ) : (
        <div className="delve-options">
          <button type="button" className="btn" onClick={() => send({ type: 'rest', choice: 'heal' })}>Rest (heal 35%)</button>
          <button type="button" className="btn ghost" disabled={!canRemove} onClick={() => setRemoving(true)}>
            Remove a card (deck {state.deck.length})
          </button>
        </div>
      )}
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

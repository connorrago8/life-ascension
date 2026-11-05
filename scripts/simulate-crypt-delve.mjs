// Balance check for the Crypt delve. Plays many seeded runs with a simple greedy policy.
// Usage: node --experimental-strip-types scripts/simulate-crypt-delve.mjs  (optional SIM_STARTER=bruiser|duelist|scholar|guardian)
import { CARDS, cardBlock, cardBleed, cardBurn, cardDef, cardThorns } from '../lib/crypt/delve/cards.ts';
import { foeIntent, intentDamage, previewDamage } from '../lib/crypt/delve/battle.ts';
import { canUpgradeCard, canWearDrop, createDelve, currentRoomChoices, reduceDelve } from '../lib/crypt/delve/run.ts';
import { isUpgrade, lootById } from '../lib/crypt/delve/loot.ts';

const ARCHETYPE_FOR = { strength: 'bruiser', agility: 'combo', intelligence: 'caster', endurance: 'tank', luck: 'luck' };
const GENERAL_RANK = ['adrenaline', 'heavy-blow', 'bash', 'flurry', 'arcane-bolt', 'expose', 'shield-bash', 'iron-skin', 'smite', 'ember', 'frost-shard', 'kindle', 'lucky-strike', 'battle-cry', 'bulwark', 'insight', 'cleaver', 'riposte', 'second-wind', 'hex', 'sidestep', 'quick-jab', 'momentum', 'gamble', 'jackpot', 'loaded-dice', 'reckless-swing', 'body-slam', 'rend', 'haste', 'spiked-guard', 'entrench'];
function pickRank(attributes) {
  const top = Object.entries(attributes).sort((a, b) => b[1] - a[1])[0][0];
  const arch = ARCHETYPE_FOR[top];
  return [...GENERAL_RANK.filter((id) => CARDS[id].archetype === arch), ...GENERAL_RANK.filter((id) => CARDS[id].archetype !== arch)];
}

function playTurn(state) {
  for (let guard = 0; guard < 20; guard += 1) {
    const b = state.battle;
    if (!b || b.status !== 'ongoing' || state.phase !== 'combat') return state;
    const incoming = intentDamage(b);
    const need = incoming ? incoming.value * incoming.hits - b.block : 0;
    const playable = b.hand.filter((c) => cardDef(c.id).cost <= b.energy);
    if (playable.length === 0) break;
    const score = (c) => {
      const def = cardDef(c.id);
      if (def.energy || def.draw || def.haste) return 100;
      if (def.focus) return b.hand.some((h) => cardDef(h.id).kind === 'attack' && cardDef(h.id).cost <= b.energy) ? 90 : -1;
      if (def.heal) return b.hp < b.maxHp * 0.6 ? 80 : -1;
      if (def.critNext) return b.critNext ? -1 : 95;
      if (def.might) return 85;
      const dmg = def.spread ? (previewDamage(b, c.id) ?? 0) + def.spread / 2 : previewDamage(b, c.id) ?? 0;
      if (dmg >= b.foe.hp + b.foe.block) return 200;
      const block = cardBlock(def, b.attributes);
      const blockValue = need > 0 ? Math.min(block, need) * 1.1 : 0;
      const poison = cardBurn(def, b.attributes) * 2 + cardBleed(def, b.attributes) * 3;
      const thorns = cardThorns(def, b.attributes) * (incoming ? incoming.hits * 2 : 1);
      const retain = def.retain && !b.retain ? 4 : 0;
      const weak = def.weak && incoming ? incoming.value * incoming.hits * 0.25 * 2 : 0;
      const dodge = def.dodgeNext && incoming && !b.dodgeNext ? incoming.value : 0;
      const self = def.selfDamage ? -def.selfDamage : 0;
      return (dmg * (def.hits ?? 1) + blockValue + thorns + retain + poison + weak + dodge + self + (def.vulnerable ? 6 : 0)) / Math.max(1, def.cost);
    };
    const best = playable.map((c) => [c, score(c)]).sort((x, y) => y[1] - x[1])[0];
    if (!best || best[1] <= 0) break;
    const next = reduceDelve(state, { type: 'play', uid: best[0].uid });
    if (next === state) break;
    state = next;
  }
  if (state.phase === 'combat' && state.battle?.status === 'ongoing') state = reduceDelve(state, { type: 'end-turn' });
  return state;
}

function runOnce(seed, level, allocated) {
  // SIM_STARTER=bruiser|duelist|scholar|guardian plays that starter deck; unset = the default deck.
  let s = createDelve({ runId: `sim-${seed}`, seed, level, allocated, deckSelect: Boolean(process.env.SIM_STARTER) });
  if (s.phase === 'deck-select') s = reduceDelve(s, { type: 'pick-deck', deckId: process.env.SIM_STARTER });
  let turns = 0; let rooms = 0; let cardsPlayed = 0; let fights = 0;
  const rank = pickRank(allocated);
  for (let guard = 0; guard < 3000; guard += 1) {
    if (s.phase === 'defeat' || s.phase === 'floor-clear') break;
    if (s.phase === 'start-pick') {
      s = reduceDelve(s, { type: 'pick-start', cardId: rank.find((id) => s.startPick.includes(id)) ?? s.startPick[0] });
    } else if (s.phase === 'map') {
      const choices = currentRoomChoices(s);
      const low = s.hp < s.maxHp * 0.5;
      const pref = (r) => r.kind === 'rest' ? (low ? 10 : 1) : r.kind === 'elite' ? (low ? -5 : 4) : r.kind === 'fight' ? (low ? 2 : 5) : r.kind === 'treasure' ? 6 : 3;
      let bestIndex = 0;
      choices.forEach((r, i) => { if (pref(r) > pref(choices[bestIndex])) bestIndex = i; });
      if (choices[bestIndex].kind === 'fight' || choices[bestIndex].kind === 'elite') fights += 1;
      s = reduceDelve(s, { type: 'choose-room', row: s.row, index: bestIndex });
      rooms += 1;
    } else if (s.phase === 'combat') {
      const before = s.battle.log.length;
      s = playTurn(s); turns += 1; cardsPlayed += Math.max(0, (s.battle?.log.length ?? before) - before - 1);
    } else if (s.phase === 'reward') {
      s = wearIfBetter(s);
      const pick = rank.find((id) => s.reward.cards.includes(id)) ?? null;
      s = reduceDelve(s, { type: 'pick-card', cardId: pick });
    } else if (s.phase === 'event') {
      if (s.event.outcome) s = reduceDelve(upgradeBest(wearIfBetter(s), rank), { type: 'continue' });
      else s = reduceDelve(s, { type: 'event-option', optionId: (s.hp > s.maxHp * 0.5 ? 0 : 0) === 0 ? requireFirst(s) : '' });
    } else if (s.phase === 'treasure') s = reduceDelve(upgradeBest(wearIfBetter(s), rank), { type: 'continue' });
    else if (s.phase === 'rest') {
      const idx = s.deck.lastIndexOf('strike') >= 0 ? s.deck.lastIndexOf('strike') : s.deck.lastIndexOf('guard');
      s = s.hp < s.maxHp * 0.8 || idx < 0 ? reduceDelve(s, { type: 'rest', choice: 'heal' }) : reduceDelve(s, { type: 'rest', choice: 'remove', index: idx });
    }
  }
  return { won: s.phase === 'floor-clear', row: s.row, turns, rooms, fights, found: s.found.length, hp: s.hp };
}
// Gear is never auto-equipped: the sim player taps Wear on a drop that beats what it wears.
function wearIfBetter(s) {
  const id = s.reward?.loot;
  const entry = id ? lootById(id) : null;
  if (!entry || !canWearDrop(s, id) || !isUpgrade(s.loadout, entry)) return s;
  return reduceDelve(s, { type: 'wear', itemId: id });
}
function upgradeBest(s, rank) {
  if (s.upgrades <= 0) return s;
  for (const id of [...rank, 'bash', 'strike', 'guard']) {
    const index = s.deck.indexOf(id);
    if (index >= 0 && canUpgradeCard(s, index)) return reduceDelve(s, { type: 'upgrade-card', index });
  }
  return s;
}
function requireFirst(s) {
  return s.event.eventId === 'whispering-shrine' && s.hp < s.maxHp * 0.6 ? 'pray' : ({ 'collapsed-passage': 'heave', 'whispering-shrine': 'blood', 'riddle-door': 'answer', 'tripwire-hall': 'careful', 'still-pool': 'drink', 'bone-dice': 'roll' })[s.event.eventId];
}

const build = (strength, agility, intelligence, endurance, luck) => ({ strength, agility, intelligence, endurance, luck });
const profiles = [
  ['L1 (9 pts)', 1, build(2, 2, 2, 2, 1)],
  ['L3 (13 pts)', 3, build(3, 3, 3, 2, 2)],
  ['L5 (17 pts)', 5, build(4, 4, 3, 3, 3)],
  ['L8 (23 pts)', 8, build(5, 5, 5, 4, 4)],
  ['L5 all-STR', 5, build(17, 0, 0, 0, 0)],
  ['L5 all-AGI', 5, build(0, 17, 0, 0, 0)],
  ['L5 all-INT', 5, build(0, 0, 17, 0, 0)],
  ['L5 all-END', 5, build(0, 0, 0, 17, 0)],
  ['L5 all-LCK', 5, build(0, 0, 0, 0, 17)],
];
const N = Number(process.env.SIM_RUNS ?? 400);
for (const [label, level, allocated] of profiles) {
  let wins = 0; let turns = 0; let rooms = 0; let found = 0; let rowSum = 0; let fullRooms = 0; let fullFights = 0; let cleared = 0;
  for (let seed = 1; seed <= N; seed += 1) {
    const r = runOnce(seed * 7919, level, allocated);
    if (r.won) { wins += 1; fullRooms += r.rooms; fullFights += r.fights; cleared += 1; }
    turns += r.turns; rooms += r.rooms; found += r.found; rowSum += r.row;
  }
  console.log(`${label.padEnd(12)} clear ${(100 * wins / N).toFixed(0).padStart(3)}%  avg rooms ${(rooms / N).toFixed(1)}  avg combat turns ${(turns / N).toFixed(1)}  avg gear ${(found / N).toFixed(1)}  avg row ${(rowSum / N).toFixed(1)}${cleared ? `  cleared path: ${(fullRooms / cleared).toFixed(1)} encounters, ${(100 * fullFights / fullRooms).toFixed(0)}% fights` : ''}`);
}

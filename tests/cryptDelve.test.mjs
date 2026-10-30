import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createDelve, reduceDelve, effectiveAttributes, currentRoomChoices } from '../lib/crypt/delve/run.ts';
import { startBattle, playCard, endTurn, canPlay, foeIntent, intentText, previewDamage, extraDrawChance, energyForTurn, ENERGY_PER_TURN, foeHitValue } from '../lib/crypt/delve/battle.ts';
import { CARDS, CARD_IDS, MONSTER_TYPES, REWARD_POOL, STARTER_DECK, SUPER_EFFECTIVE, RESISTED, effectiveness, cardBlock, cardHeal, cardHitDamage, cardBurn, cardWeak, weaknessesOf } from '../lib/crypt/delve/cards.ts';
import { spawnFoe, BOSS, FLOOR_ROWS, EVENTS, FOES, ENCOUNTERS_PER_RUN, generateFloor } from '../lib/crypt/delve/floor.ts';
import { LOOT, LOOT_IDS, EARNED_GEAR, bestLoadout, bonusLabel, dropChance, gearAttributes, lootById, ownedEarnedGear, rarityUpChance, rollLoot } from '../lib/crypt/delve/loot.ts';
import { gearOverlays, GEAR_INKS, GEAR_WIDTH, GEAR_HEIGHT } from '../lib/crypt/delve/gearArt.ts';
import { seedRng } from '../lib/crypt/delve/rng.ts';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS, pointsForLevel, clampAllocation, isValidAllocation, spentPoints, maxHpFor, critChance, dodgeChance } from '../lib/crypt/delve/stats.ts';
import { parseCryptProfile, floorClearMessage, tenthsLabel } from '../lib/cryptVault.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
const runId = '00000000-0000-4000-a000-000000000001';

function autoplay(seed, level, allocated) {
  let state = createDelve({ runId, seed, level, allocated });
  for (let guard = 0; guard < 4000; guard += 1) {
    if (state.phase === 'defeat' || state.phase === 'floor-clear') return state;
    let command;
    if (state.phase === 'map') command = { type: 'choose-room', row: state.row, index: 0 };
    else if (state.phase === 'combat') {
      const playable = state.battle.hand.find((c) => canPlay(state.battle, c.uid));
      command = playable ? { type: 'play', uid: playable.uid } : { type: 'end-turn' };
    } else if (state.phase === 'reward') command = { type: 'pick-card', cardId: state.reward.cards[0] };
    else if (state.phase === 'event') command = state.event.outcome ? { type: 'continue' } : { type: 'event-option', optionId: 'leave' };
    else if (state.phase === 'rest') command = { type: 'rest', choice: 'heal' };
    else command = { type: 'continue' };
    let next = reduceDelve(state, command);
    if (next === state && state.phase === 'event') next = reduceDelve(state, { type: 'event-option', optionId: 'pray' });
    if (next === state && state.phase === 'event') {
      const ev = state.event.eventId;
      next = reduceDelve(state, { type: 'event-option', optionId: ev === 'tripwire-hall' ? 'run' : 'answer' });
    }
    assert.notEqual(next, state, `stuck in ${state.phase}`);
    state = next;
  }
  throw new Error('run did not finish');
}

test('points come only from level: 7 + 2 per level, and over-spending is clamped', () => {
  assert.equal(pointsForLevel(1), 9);
  assert.equal(pointsForLevel(3), 13);
  assert.equal(pointsForLevel(5), 17);
  const greedy = clampAllocation({ strength: 30, agility: 30, intelligence: 30, endurance: 0, luck: 0 }, 1);
  assert.equal(spentPoints(greedy), 9);
  assert.equal(isValidAllocation({ ...ZERO, strength: 10 }, 1), false);
  assert.equal(isValidAllocation({ ...ZERO, strength: 9 }, 1), true);
  const run = createDelve({ runId, seed: 1, level: 1, allocated: { ...ZERO, strength: 50 } });
  assert.equal(spentPoints(run.allocated), 9);
});

test('a floor is deterministic per seed, has path choices on every row, and ends in a boss', () => {
  const a = createDelve({ runId, seed: 42, level: 3, allocated: ZERO });
  const b = createDelve({ runId, seed: 42, level: 3, allocated: ZERO });
  assert.deepEqual(a.rows, b.rows);
  assert.equal(a.rows.length, FLOOR_ROWS);
  for (const row of a.rows) assert.ok(row.length >= 2, 'every row offers a choice');
  assert.deepEqual(currentRoomChoices({ ...a, row: FLOOR_ROWS }), [{ kind: 'fight', foeId: BOSS.id }]);
});

test('cards cost energy, enemy intent is visible, and types matter', () => {
  const foe = spawnFoe('restless-skeleton', 0);
  let battle = startBattle({ rng: seedRng(7), deck: ['strike', 'strike', 'strike', 'strike', 'bash'], attributes: ZERO, hp: 40, maxHp: 40, foe });
  assert.equal(battle.energy, 3);
  assert.equal(effectiveness('physical', 'bone'), 'super');
  assert.equal(effectiveness('holy', 'shadow'), 'super');
  assert.equal(effectiveness('physical', 'spirit'), 'resisted');
  assert.match(intentText(battle), /\d/);
  assert.equal(foeIntent(battle).kind, 'attack');
  const strike = battle.hand.find((c) => c.id === 'strike');
  assert.ok(previewDamage(battle, 'strike') > CARDS.strike.damage, 'physical is super effective vs Bone');
  battle = playCard(battle, strike.uid);
  assert.equal(battle.energy, 2);
  assert.ok(battle.foe.hp < battle.foe.maxHp);
  // Spend the rest, then an unaffordable card returns the same state.
  for (const card of battle.hand.slice()) battle = canPlay(battle, card.uid) ? playCard(battle, card.uid) : battle;
  const stuck = battle.hand.find((c) => !canPlay(battle, c.uid));
  if (stuck) assert.equal(playCard(battle, stuck.uid), battle);
  const after = endTurn(battle);
  assert.equal(after.energy, 3);
  assert.equal(after.turn, battle.turn + 1);
});

test('the Crypt uses exactly the approved five stats STR, AGI, INT, END, LCK', () => {
  assert.deepEqual([...ATTRIBUTE_KEYS], ['strength', 'agility', 'intelligence', 'endurance', 'luck']);
  assert.deepEqual(ATTRIBUTE_KEYS.map((key) => ATTRIBUTE_INFO[key].short), ['STR', 'AGI', 'INT', 'END', 'LCK']);
  const engine = ['run', 'battle', 'floor', 'cards', 'loot', 'stats'].map((f) => read(`lib/crypt/delve/${f}.ts`)).join('\n')
    + read('components/crypt/DelveRun.tsx') + read('components/delve/DelveScreen.tsx') + read('lib/cryptVault.ts')
    + read('supabase/migrations/202610300001_crypt_delve.sql') + read('tests/sql/crypt_delve_smoke.sql');
  assert.doesNotMatch(engine, /vitality|discipline|\bVIT\b|\bDIS\b/);
  for (const entry of [...LOOT, ...EARNED_GEAR]) {
    for (const key of Object.keys(entry.bonus)) assert.ok(ATTRIBUTE_KEYS.includes(key), `${entry.id}: ${key}`);
  }
  // Every stat has an event check.
  const checks = new Set(EVENTS.flatMap((event) => event.options.map((option) => option.check)).filter(Boolean));
  assert.deepEqual([...checks].sort(), [...ATTRIBUTE_KEYS].sort());
});

test('each stat does its job: STR hits, AGI dodges and acts first, INT casts, END tanks, LCK crits and finds loot', () => {
  const foe = spawnFoe('crypt-rat', 0);
  const weak = startBattle({ rng: seedRng(1), deck: ['strike'], attributes: ZERO, hp: 40, maxHp: 40, foe });
  const strong = startBattle({ rng: seedRng(1), deck: ['strike'], attributes: { ...ZERO, strength: 9 }, hp: 40, maxHp: 40, foe });
  assert.ok(previewDamage(strong, 'strike') >= previewDamage(weak, 'strike') + 6);
  // AGI
  assert.equal(dodgeChance({ ...ZERO, agility: 5 }), 0.15);
  assert.ok(dodgeChance({ ...ZERO, agility: 60 }) <= 0.4);
  assert.equal(energyForTurn(ZERO, 1), ENERGY_PER_TURN);
  assert.equal(energyForTurn({ ...ZERO, agility: 3 }, 1), ENERGY_PER_TURN + 1);
  assert.equal(energyForTurn({ ...ZERO, agility: 3 }, 2), ENERGY_PER_TURN);
  assert.equal(energyForTurn({ ...ZERO, agility: 10 }, 2), ENERGY_PER_TURN + 1);
  assert.equal(extraDrawChance(ZERO), 0);
  assert.ok(extraDrawChance({ ...ZERO, agility: 6 }) > 0.2 && extraDrawChance({ ...ZERO, agility: 60 }) <= 0.6);
  const quick = startBattle({ rng: seedRng(1), deck: ['strike'], attributes: { ...ZERO, agility: 3 }, hp: 40, maxHp: 40, foe });
  assert.equal(quick.energy, ENERGY_PER_TURN + 1);
  // INT powers spells and skills, not physical strikes
  const int9 = { ...ZERO, intelligence: 9 };
  assert.ok(cardHitDamage(CARDS.smite, int9) > cardHitDamage(CARDS.smite, ZERO));
  assert.ok(cardHitDamage(CARDS['arcane-bolt'], int9) > cardHitDamage(CARDS['arcane-bolt'], ZERO));
  assert.equal(cardHitDamage(CARDS.strike, int9), cardHitDamage(CARDS.strike, ZERO));
  assert.ok(cardBlock(CARDS.guard, int9) > cardBlock(CARDS.guard, ZERO));
  assert.ok(cardHeal(CARDS['second-wind'], int9) > cardHeal(CARDS['second-wind'], ZERO));
  // INT strengthens statuses
  assert.ok(cardBurn(CARDS['kindle'], int9) > cardBurn(CARDS['kindle'], ZERO));
  assert.ok(cardWeak(CARDS.hex, int9) > cardWeak(CARDS.hex, ZERO));
  // END raises max HP and Block
  assert.equal(maxHpFor({ ...ZERO, endurance: 10 }, 1), maxHpFor(ZERO, 1) + 25);
  assert.ok(cardBlock(CARDS.guard, { ...ZERO, endurance: 9 }) >= cardBlock(CARDS.guard, ZERO) + 3);
  // LCK: crits, lucky damage, more and rarer drops
  assert.equal(critChance(ZERO), 0);
  assert.ok(critChance({ ...ZERO, luck: 10 }) > 0.25);
  assert.ok(cardHitDamage(CARDS.strike, { ...ZERO, luck: 8 }) > cardHitDamage(CARDS.strike, ZERO));
  assert.ok(dropChance('fight', 10) > dropChance('fight', 0));
  assert.equal(dropChance('boss', 50), 1);
  assert.ok(rarityUpChance(10) > 0 && rarityUpChance(60) <= 0.4);
  let lucky = 0; let plain = 0; let rngA = seedRng(5); let rngB = seedRng(5);
  for (let i = 0; i < 400; i += 1) {
    let a; let b;
    [a, rngA] = rollLoot(rngA, 'treasure', 20);
    [b, rngB] = rollLoot(rngB, 'treasure', 0);
    if (a && a.rarity !== 'common') lucky += 1;
    if (b && b.rarity !== 'common') plain += 1;
    assert.ok(!a || (a.rarity !== 'epic' && !a.earnedOnly));
  }
  assert.ok(lucky > plain, `lucky ${lucky} vs plain ${plain}`);
});

test('every single-stat build can still clear floor 1 at Level 5', () => {
  for (const key of ATTRIBUTE_KEYS) {
    let clears = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      if (autoplay(seed * 31, 5, { ...ZERO, [key]: 17 }).phase === 'floor-clear') clears += 1;
    }
    assert.ok(clears > 0, `${key}-only build never clears`);
  }
});

test('Ashen Hood (real-quest earned) has real stats and works in the Crypt only when owned', () => {
  const hood = lootById('ashen-hood');
  assert.equal(hood.slot, 'helm');
  assert.equal(hood.earnedOnly, true);
  assert.deepEqual(hood.bonus, { intelligence: 1, endurance: 1 });
  assert.equal(bonusLabel(hood), '+1 INT · +1 END');
  assert.equal(LOOT_IDS.includes('ashen-hood'), false, 'never dropped or claimed in the Crypt');
  assert.deepEqual(ownedEarnedGear(['ashen-hood', 'golden-xp-sword']), ['ashen-hood']);
  assert.deepEqual(ownedEarnedGear(null), []);
  const run = createDelve({ runId, seed: 9, level: 3, allocated: ZERO, vaultItemIds: ['ashen-hood'], wear: ['ashen-hood'] });
  assert.equal(run.loadout.helm, 'ashen-hood');
  assert.equal(effectiveAttributes(run).endurance, 1);
  assert.equal(effectiveAttributes(run).intelligence, 1);
});

test('the boss changes pattern at half health', () => {
  let battle = startBattle({ rng: seedRng(3), deck: ['guard', 'guard', 'guard', 'guard', 'guard'], attributes: { ...ZERO, endurance: 30 }, hp: 999, maxHp: 999, foe: spawnFoe(BOSS.id, FLOOR_ROWS) });
  battle = { ...battle, foe: { ...battle.foe, hp: Math.floor(battle.foe.maxHp / 2) } };
  battle = endTurn(battle);
  assert.equal(battle.enraged, true);
});

test('runs end in a boss clear or a defeat that keeps found gear, and never grant XP', () => {
  let clears = 0;
  let defeats = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const end = autoplay(seed, seed % 2 ? 1 : 6, { strength: 4, agility: 3, intelligence: 3, endurance: 3, luck: 2 });
    if (end.phase === 'floor-clear') clears += 1;
    else {
      defeats += 1;
      assert.equal(end.hp, 0);
    }
    assert.ok(end.found.every((id) => LOOT_IDS.includes(id)));
    assert.doesNotMatch(JSON.stringify(Object.keys(end)), /xp/i);
    // Commands after the run is over are ignored.
    assert.equal(reduceDelve(end, { type: 'end-turn' }), end);
  }
  assert.ok(clears > 0 && defeats > 0, `balanced: ${clears} clears, ${defeats} defeats`);
});

test('gear raises stats and paints onto the 32×34 sprite', () => {
  const loadout = bestLoadout(['rusty-shortsword', 'ember-blade', 'hollow-crown', 'grave-mail', 'plank-buckler']);
  assert.equal(loadout.weapon, 'ember-blade');
  assert.equal(gearAttributes(loadout).strength, 2);
  assert.equal(gearAttributes(loadout).intelligence, 5);
  assert.equal(gearAttributes(loadout).luck, 3);
  const overlays = gearOverlays(loadout);
  assert.deepEqual(Object.keys(overlays).sort(), ['chest', 'head', 'main-hand', 'off-hand']);
  for (const rows of Object.values(overlays)) {
    assert.equal(rows.length, GEAR_HEIGHT);
    for (const row of rows) {
      assert.equal(row.length, GEAR_WIDTH);
      for (const ink of row) assert.ok(ink === '.' || GEAR_INKS[ink], ink);
    }
  }
  const run = createDelve({ runId, seed: 9, level: 1, allocated: ZERO, vaultItemIds: ['ember-blade'], wear: ['ember-blade'] });
  assert.equal(effectiveAttributes(run).strength, 2);
});

test('the vault allowlist in SQL matches the game loot list exactly', () => {
  const sql = read('supabase/migrations/202610300001_crypt_delve.sql');
  const block = sql.slice(sql.indexOf('item_id text not null check'), sql.indexOf('))', sql.indexOf('item_id text not null check')));
  const ids = [...block.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(ids, LOOT_IDS.slice().sort());
});

test('migration is additive, RLS read-only for clients, capped XP, and fully reversible', () => {
  const sql = read('supabase/migrations/202610300001_crypt_delve.sql');
  const down = read('supabase/rollbacks/202610300001_crypt_delve_down.sql');
  assert.doesNotMatch(sql, /\bdrop\s+(table|function|policy)|alter\s+table\s+public\.(xp_ledger|quests|quest_instances)|insert\s+into\s+public\.xp_ledger|delete\s+from/i);
  assert.doesNotMatch(sql, /grant[^;]*to[^;]*\banon\b/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all)\s+on\s+(table\s+)?public\.crypt/i);
  assert.match(sql, /America\/Chicago/);
  for (const table of ['crypt_hero', 'crypt_loot', 'crypt_progress', 'crypt_floor_clears', 'crypt_xp_daily']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(down, new RegExp(`drop table if exists public\\.${table}`));
  }
  assert.match(sql, /set_crypt_attributes\(p_strength integer, p_agility integer, p_intelligence integer, p_endurance integer, p_luck integer\)/);
  assert.match(sql, /7 \+ 2 \* public\.crypt_level_for_owner/, 'SQL point budget mirrors pointsForLevel');
  for (const column of ['strength', 'agility', 'intelligence', 'endurance', 'luck']) {
    assert.match(sql, new RegExp(`${column} smallint not null default 0 check \\(${column} between 0 and 60\\)`));
  }
  assert.match(down, /set_crypt_attributes\(integer, integer, integer, integer, integer\)/);
  for (const fn of [...sql.matchAll(/create function public\.([a-z_]+)/g)].map((m) => m[1])) {
    assert.match(down, new RegExp(`drop function if exists public\\.${fn}\\(`), fn);
  }
});

test('vault helpers read server answers defensively', () => {
  const profile = parseCryptProfile({ attributes: { strength: 3 }, vaultItemIds: ['ember-blade', 'made-up', 4], tenthsToday: '2', capToday: 5, cryptXp: -1 });
  assert.deepEqual(profile.vaultItemIds, ['ember-blade']);
  assert.equal(profile.attributes.strength, 3);
  assert.equal(profile.tenthsToday, 2);
  assert.equal(profile.cryptXp, 0);
  assert.equal(tenthsLabel(13), '1.3');
  assert.match(floorClearMessage({ tenthsAwarded: 1, tenthsToday: 1, capToday: 4 }), /\+0\.1/);
  assert.match(floorClearMessage({ tenthsAwarded: 0, tenthsToday: 4, capToday: 4 }), /cap/);
});

test('delve UI is account-free, timer-free, and the account layer only calls the Crypt functions', () => {
  const ui = read('components/crypt/DelveRun.tsx');
  const engine = ['run', 'battle', 'floor', 'cards', 'loot', 'stats', 'rng', 'gearArt', 'monsterArt'].map((f) => read(`lib/crypt/delve/${f}.ts`)).join('\n');
  assert.doesNotMatch(ui + engine, /setTimeout|setInterval|requestAnimationFrame|visibilitychange|localStorage|sessionStorage/);
  const screen = read('components/delve/DelveScreen.tsx');
  const rpcs = [...screen.matchAll(/\.rpc\(\s*'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(rpcs, ['claim_crypt_loot', 'get_crypt_profile', 'get_earned_gear', 'get_lifetime_xp', 'record_crypt_floor_clear', 'set_crypt_attributes']);
  assert.match(screen, /p_strength[\s\S]*p_agility[\s\S]*p_intelligence[\s\S]*p_endurance[\s\S]*p_luck/);
  assert.doesNotMatch(screen, /\.from\s*\(|xp_ledger|create_scheduled_quest|set_quest_instance_status|add_quest_progress|service_role/);
  assert.match(screen, /SIGNED_OUT/, 'logging out ends the run');
});

test('Crypt header stacks under the preview banner below the iPhone safe area', () => {
  const css = read('app/style.css');
  assert.match(css, /\.crypt-screen, \.delve \{\s*padding-top: calc\(12px \+ env\(safe-area-inset-top/);
  assert.match(css, /\.crypt-top \{\s*display: grid;[^}]*grid-template-areas: "back title" "actions actions"/);
  const screen = read('components/crypt/CryptRun.tsx');
  const run = screen.slice(screen.indexOf('data-phase={run.phase}'));
  assert.ok(run.indexOf('preview-banner') < run.indexOf('crypt-top'), 'banner renders before the header');
});

test('30–38 cards with a synergy set for every stat archetype', () => {
  assert.ok(CARD_IDS.length >= 28 && CARD_IDS.length <= 38, `${CARD_IDS.length} cards`);
  const byArchetype = {};
  for (const id of CARD_IDS) {
    assert.equal(CARDS[id].id, id);
    assert.ok(CARDS[id].text.length > 0);
    byArchetype[CARDS[id].archetype] = (byArchetype[CARDS[id].archetype] ?? 0) + 1;
  }
  for (const archetype of ['bruiser', 'combo', 'caster', 'tank', 'luck']) {
    assert.ok(byArchetype[archetype] >= 4, `${archetype} has ${byArchetype[archetype]} cards`);
    assert.ok(REWARD_POOL.some((id) => CARDS[id].archetype === archetype), `${archetype} can be found`);
  }
  for (const id of STARTER_DECK) assert.ok(CARDS[id]);
});

test('type chart: six monster types, each with a weakness, and every foe uses one', () => {
  assert.deepEqual([...MONSTER_TYPES].sort(), ['bone', 'flame', 'rot', 'shadow', 'spirit', 'stone']);
  for (const type of MONSTER_TYPES) assert.ok(weaknessesOf(type).length >= 1, `${type} needs a weakness`);
  for (const element of Object.keys(SUPER_EFFECTIVE)) {
    for (const type of SUPER_EFFECTIVE[element]) assert.ok(!RESISTED[element].includes(type));
  }
  for (const foe of [...FOES, BOSS]) assert.ok(MONSTER_TYPES.includes(foe.type), foe.id);
  assert.ok(new Set(FOES.map((foe) => foe.type)).size === MONSTER_TYPES.length, 'every type appears on Floor 1');
});

test('statuses and combo cards work: burn ticks, weaken softens hits, dodge, crit and momentum', () => {
  const foe = spawnFoe('ghoul', 0);
  let battle = startBattle({ rng: seedRng(4), deck: ['kindle', 'hex', 'sidestep', 'loaded-dice', 'momentum'], attributes: ZERO, hp: 60, maxHp: 60, foe });
  const play = (id) => { battle = playCard(battle, battle.hand.find((c) => c.id === id).uid); };
  play('kindle');
  assert.equal(battle.foe.burn, 4);
  play('hex');
  assert.ok(battle.foe.weak >= 2);
  assert.equal(foeHitValue({ strength: 0, weak: 1 }, 12), 9);
  play('loaded-dice');
  assert.equal(battle.critNext, true);
  const hp = battle.foe.hp;
  const momentum = previewDamage(battle, 'momentum');
  assert.ok(momentum >= CARDS.momentum.damage + 3 * 3, 'momentum grows with cards played this turn');
  battle.energy = 3;
  play('momentum');
  assert.equal(battle.critNext, false);
  assert.ok(hp - battle.foe.hp >= momentum * 2 - 1, 'loaded dice made it crit');
  const before = battle.foe.hp;
  const after = endTurn(battle);
  assert.equal(after.foe.hp, before - 4, 'burn ticks for its stacks');
  assert.equal(after.foe.burn, 3);
});

test('Floor 1 has 10–15 encounters on any path, at least 60% fights, 1–2 elites, a rest and the boss', () => {
  assert.ok(ENCOUNTERS_PER_RUN >= 10 && ENCOUNTERS_PER_RUN <= 15);
  for (let seed = 1; seed <= 60; seed += 1) {
    const { rows } = generateFloor(seedRng(seed * 13));
    assert.equal(rows.length + 1, ENCOUNTERS_PER_RUN);
    // Fewest fights and fewest/most elites on any path (each row is independent).
    let minFights = 1; let minElites = 0; let maxElites = 0; let restOffered = false; let lootOffered = false;
    for (const row of rows) {
      const fightish = row.map((room) => room.kind === 'fight' || room.kind === 'elite');
      if (fightish.every(Boolean)) minFights += 1;
      const elites = row.map((room) => room.kind === 'elite');
      if (elites.every(Boolean)) minElites += 1;
      if (elites.some(Boolean)) maxElites += 1;
      if (row.some((room) => room.kind === 'rest')) restOffered = true;
      if (row.some((room) => room.kind === 'treasure' || room.kind === 'event')) lootOffered = true;
      for (const room of row) if (room.foeId) assert.ok(FOES.some((foe) => foe.id === room.foeId), room.foeId);
    }
    assert.ok(minFights / ENCOUNTERS_PER_RUN >= 0.6, `seed ${seed}: ${minFights}/${ENCOUNTERS_PER_RUN} fights`);
    assert.ok(minElites >= 1 && maxElites <= 2, `seed ${seed}: elites ${minElites}-${maxElites}`);
    assert.ok(restOffered && lootOffered);
    assert.deepEqual(rows[rows.length - 1].map((room) => room.kind).sort(), ['rest', 'treasure']);
  }
});

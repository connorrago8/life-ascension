import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runMcpTool } from '../lib/mcpTools.ts';
import { calendarDate, questDay as clientQuestDay } from '../lib/questDay.ts';
import { questDay as serverQuestDay } from '../lib/questDay.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHICAGO = 'America/Chicago';
const alice = '00000000-0000-0000-0000-0000000000a1';

// Read Chicago civil time with Intl. This is the oracle. It does not subtract
// a fixed UTC offset, and it does not call questDay.
const chicagoFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: CHICAGO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function chicagoWall(instant) {
  const parts = chicagoFormat.formatToParts(instant);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  let hour = read('hour');
  if (hour === 24) hour = 0;
  return { year: read('year'), month: read('month'), day: read('day'), hour, minute: read('minute'), second: read('second') };
}

function iso(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function previousIso(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function expectedQuestDay(year, month, day, hour) {
  return hour < 5 ? previousIso(year, month, day) : iso(year, month, day);
}

// Find real instants whose Chicago wall clock is the requested minute by
// scanning UTC and asking Intl what Chicago says. The scan window is not an
// offset: a hit counts only when the zone reports that exact civil time.
function instantsAtChicago(year, month, day, hour, minute) {
  const anchor = Date.UTC(year, month - 1, day, 12, 0, 0);
  const start = anchor - 36 * 60 * 60 * 1000;
  const end = anchor + 36 * 60 * 60 * 1000;
  const hits = [];
  for (let time = start; time <= end; time += 60 * 1000) {
    const instant = new Date(time);
    const wall = chicagoWall(instant);
    if (wall.year === year && wall.month === month && wall.day === day && wall.hour === hour && wall.minute === minute && wall.second === 0) {
      hits.push(instant);
    }
  }
  return hits;
}

function onlyInstant(year, month, day, hour, minute) {
  const hits = instantsAtChicago(year, month, day, hour, minute);
  assert.equal(
    hits.length,
    1,
    `expected one Chicago instant for ${iso(year, month, day)} ${hour}:${String(minute).padStart(2, '0')}, found ${hits.length}`,
  );
  return hits[0];
}

function assertWallQuestDay(year, month, day, hour, minute, expectedCount) {
  const hits = instantsAtChicago(year, month, day, hour, minute);
  assert.equal(hits.length, expectedCount, `${iso(year, month, day)} ${hour}:${String(minute).padStart(2, '0')}`);
  const expected = expectedQuestDay(year, month, day, hour);
  for (const instant of hits) {
    const wall = chicagoWall(instant);
    assert.deepEqual(
      { year: wall.year, month: wall.month, day: wall.day, hour: wall.hour, minute: wall.minute },
      { year, month, day, hour, minute },
    );
    assert.equal(clientQuestDay(instant, CHICAGO), expected);
    assert.equal(serverQuestDay(instant, CHICAGO), expected);
    assert.equal(clientQuestDay(instant, CHICAGO), serverQuestDay(instant, CHICAGO));
    assert.equal(calendarDate(instant, CHICAGO), iso(year, month, day));
  }
  return hits;
}

const mornings = [
  ['ordinary summer', 2026, 6, 15, '2026-06-14', '2026-06-15'],
  ['ordinary winter', 2026, 1, 15, '2026-01-14', '2026-01-15'],
  ['spring-forward', 2026, 3, 8, '2026-03-07', '2026-03-08'],
  ['fall-back', 2026, 11, 1, '2026-10-31', '2026-11-01'],
];

test('wall clock: ordinary summer day 2026-06-15 rolls at 5:00 AM Chicago, including 1-3 AM', () => {
  for (const hour of [1, 2, 3]) assertWallQuestDay(2026, 6, 15, hour, 0, 1);
  assertWallQuestDay(2026, 6, 15, 4, 59, 1);
  assertWallQuestDay(2026, 6, 15, 5, 0, 1);
  const at459 = onlyInstant(2026, 6, 15, 4, 59);
  const lastSecond = new Date(at459.getTime() + 59 * 1000);
  assert.equal(chicagoWall(lastSecond).hour, 4);
  assert.equal(chicagoWall(lastSecond).minute, 59);
  assert.equal(clientQuestDay(lastSecond, CHICAGO), '2026-06-14');
  const at500 = new Date(at459.getTime() + 60 * 1000);
  assert.equal(chicagoWall(at500).hour, 5);
  assert.equal(chicagoWall(at500).minute, 0);
  assert.equal(clientQuestDay(at500, CHICAGO), '2026-06-15');
});

test('wall clock: ordinary winter day 2026-01-15 rolls at 5:00 AM Chicago, including 1-3 AM', () => {
  for (const hour of [1, 2, 3]) assertWallQuestDay(2026, 1, 15, hour, 0, 1);
  assertWallQuestDay(2026, 1, 15, 4, 59, 1);
  assertWallQuestDay(2026, 1, 15, 5, 0, 1);
  const summer = onlyInstant(2026, 6, 15, 5, 0);
  const winter = onlyInstant(2026, 1, 15, 5, 0);
  assert.notEqual(summer.getUTCHours(), winter.getUTCHours());
});

test('wall clock: 2026-03-08 spring-forward 1-3 AM, 4:59 AM, and 5:00 AM Chicago', () => {
  assertWallQuestDay(2026, 3, 8, 1, 0, 1);
  assertWallQuestDay(2026, 3, 8, 1, 30, 1);
  assertWallQuestDay(2026, 3, 8, 2, 0, 0);
  assertWallQuestDay(2026, 3, 8, 2, 30, 0);
  assertWallQuestDay(2026, 3, 8, 3, 0, 1);
  assertWallQuestDay(2026, 3, 8, 3, 30, 1);
  assertWallQuestDay(2026, 3, 8, 4, 59, 1);
  assertWallQuestDay(2026, 3, 8, 5, 0, 1);
  const spring = onlyInstant(2026, 3, 8, 5, 0);
  const summer = onlyInstant(2026, 6, 15, 5, 0);
  assert.equal(spring.getUTCHours(), summer.getUTCHours());
});

test('wall clock: 2026-11-01 fall-back 1-3 AM, 4:59 AM, and 5:00 AM Chicago', () => {
  const one = assertWallQuestDay(2026, 11, 1, 1, 0, 2);
  assertWallQuestDay(2026, 11, 1, 1, 30, 2);
  assert.notEqual(one[0].toISOString(), one[1].toISOString());
  for (const instant of one) assert.equal(clientQuestDay(instant, CHICAGO), '2026-10-31');
  assertWallQuestDay(2026, 11, 1, 2, 0, 1);
  assertWallQuestDay(2026, 11, 1, 2, 30, 1);
  assertWallQuestDay(2026, 11, 1, 3, 0, 1);
  assertWallQuestDay(2026, 11, 1, 3, 30, 1);
  assertWallQuestDay(2026, 11, 1, 4, 59, 1);
  assertWallQuestDay(2026, 11, 1, 5, 0, 1);
  const fall = onlyInstant(2026, 11, 1, 5, 0);
  const winter = onlyInstant(2026, 1, 15, 5, 0);
  assert.equal(fall.getUTCHours(), winter.getUTCHours());
});

function freshStore() {
  return {
    nextId: 1,
    quests: [{
      id: 'habit',
      owner_id: alice,
      title: 'Stretch',
      domain: 'physical_health',
      cadence: 'daily',
      quest_type: 'scheduled',
      scheduled_for: '2020-01-01',
      active: true,
    }],
    quest_instances: [],
    xp_ledger: [],
  };
}

function ensureInstance(store, questId, dueDate) {
  const quest = store.quests.find((row) => row.id === questId && row.owner_id === alice && row.active);
  if (!quest) return { error: 'Quest not found' };
  if (quest.scheduled_for && dueDate < quest.scheduled_for) return { error: 'Quest not yet scheduled' };
  const existing = store.quest_instances.find((row) => row.quest_id === questId && row.due_date === dueDate);
  if (existing) return { id: existing.id, created: false };
  const row = {
    id: `inst-${store.nextId}`,
    quest_id: questId,
    owner_id: alice,
    due_date: dueDate,
    status: 'available',
  };
  store.nextId += 1;
  store.quest_instances.push(row);
  return { id: row.id, created: true };
}

function completeInstance(store, instanceId) {
  const row = store.quest_instances.find((item) => item.id === instanceId && item.owner_id === alice);
  if (!row) return { error: 'Instance not found' };
  if (row.status === 'completed') return { status: 'completed', awarded: false };
  row.status = 'completed';
  if (!store.xp_ledger.some((item) => item.instance_id === row.id)) {
    store.xp_ledger.push({ owner_id: alice, instance_id: row.id, amount: 1 });
    return { status: 'completed', awarded: true };
  }
  return { status: 'completed', awarded: false };
}

function xpFor(store, instanceId) {
  return store.xp_ledger.filter((row) => row.instance_id === instanceId).reduce((sum, row) => sum + row.amount, 0);
}

function openBoard(store, instant) {
  const day = clientQuestDay(instant, CHICAGO);
  const before = store.quest_instances.map((row) => ({ id: row.id, due_date: row.due_date, status: row.status }));
  const xp = store.xp_ledger.length;
  const opened = ensureInstance(store, 'habit', day);
  assert.equal(opened.error, undefined);
  for (const prev of before) {
    const row = store.quest_instances.find((item) => item.id === prev.id);
    assert.ok(row, `instance ${prev.id} was deleted at rollover`);
    assert.equal(row.status, prev.status);
    assert.equal(row.due_date, prev.due_date);
  }
  assert.equal(store.xp_ledger.length, xp);
  return day;
}

class Query {
  constructor(rows) {
    this.rows = rows;
    this.filters = [];
    this.single = false;
  }

  eq(column, value) {
    this.filters.push([column, value]);
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  then(resolve, reject) {
    try {
      resolve(this.exec());
    } catch (error) {
      reject(error);
    }
  }

  exec() {
    const rows = this.rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));
    if (this.single) {
      if (rows.length > 1) return { data: null, error: { message: 'multiple rows' } };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

function memoryDb(store) {
  return {
    from(table) {
      return { select() { return new Query(store[table]); } };
    },
    async rpc(fn, args) {
      if (fn === 'ensure_quest_instance' || fn === 'ensure_quest_instance_as_user') {
        const opened = ensureInstance(store, args.p_quest_id, args.p_date);
        if (opened.error) return { data: null, error: { message: opened.error } };
        return { data: opened.id, error: null };
      }
      if (fn === 'set_quest_instance_status' || fn === 'set_quest_instance_status_as_user') {
        const result = completeInstance(store, args.p_instance_id);
        if (result.error) return { data: null, error: { message: result.error } };
        return { data: result.status, error: null };
      }
      return { data: null, error: { message: `unexpected rpc ${fn}` } };
    },
  };
}

async function submit(store, instant, dueDate) {
  const clientDay = clientQuestDay(instant, CHICAGO);
  const serverDay = serverQuestDay(instant, CHICAGO);
  assert.equal(serverDay, clientDay);
  const args = { quest_id: 'habit', confirmed_complete: true };
  if (dueDate) args.due_date = dueDate;
  return runMcpTool({
    db: memoryDb(store),
    userId: alice,
    method: 'api_key',
    name: 'submit_completion',
    args,
    today: calendarDate(instant, CHICAGO),
    questDay: serverDay,
  });
}

async function assertCountsFor(year, month, day, hour, minute, expectedDue) {
  const instant = onlyInstant(year, month, day, hour, minute);
  assert.equal(chicagoWall(instant).hour, hour);
  assert.equal(chicagoWall(instant).minute, minute);
  const store = freshStore();
  const boardDay = openBoard(store, instant);
  assert.equal(boardDay, expectedDue);
  const visible = store.quest_instances.find((row) => row.quest_id === 'habit' && row.due_date === boardDay);
  const boardResult = completeInstance(store, visible.id);
  assert.equal(boardResult.awarded, true);
  assert.equal(visible.due_date, expectedDue);
  assert.equal(visible.status, 'completed');
  assert.equal(xpFor(store, visible.id), 1);

  const apiStore = freshStore();
  const outcome = await submit(apiStore, instant);
  assert.equal(outcome.ok, true, outcome.message);
  const recorded = apiStore.quest_instances.find((row) => row.id === outcome.result.instance_id);
  assert.equal(recorded.due_date, expectedDue);
  assert.equal(recorded.status, 'completed');
  assert.equal(xpFor(apiStore, recorded.id), 1);
  assert.equal(clientQuestDay(instant, CHICAGO), serverQuestDay(instant, CHICAGO));
}

for (const [label, year, month, day, previous, current] of mornings) {
  test(`(a) 4:59 AM Chicago on ${label} counts for ${previous}`, async () => {
    await assertCountsFor(year, month, day, 4, 59, previous);
    const instant = onlyInstant(year, month, day, 4, 59);
    assert.equal(calendarDate(instant, CHICAGO), current);
    assert.notEqual(clientQuestDay(instant, CHICAGO), current);
  });

  test(`(b) 5:00 AM Chicago on ${label} counts for ${current}`, async () => {
    await assertCountsFor(year, month, day, 5, 0, current);
    const instant = onlyInstant(year, month, day, 5, 0);
    assert.equal(calendarDate(instant, CHICAGO), current);
    assert.equal(clientQuestDay(instant, CHICAGO), current);
  });
}

test('(c) an unfinished quest is not deleted or auto-completed at rollover', () => {
  const page = readFileSync(join(root, 'app/page.tsx'), 'utf8');
  const loadStart = page.indexOf('const load=useCallback');
  const loadFn = page.slice(loadStart, page.indexOf('useEffect(()=>{', loadStart));
  assert.match(loadFn, /ensure_quest_instance/);
  assert.doesNotMatch(loadFn, /set_quest_instance_status/);
  const refreshStart = page.indexOf('nextQuestDayStart');
  const refresh = page.slice(refreshStart, page.indexOf('},[load]);', refreshStart));
  assert.match(refresh, /void load\(\)/);
  assert.doesNotMatch(refresh, /set_quest_instance_status|xp_ledger|\.delete\(/);

  for (const [label, year, month, day, previous, current] of mornings) {
    const store = freshStore();
    const early = onlyInstant(year, month, day, 4, 59);
    const late = onlyInstant(year, month, day, 5, 0);
    assert.equal(openBoard(store, early), previous, label);
    const unfinished = store.quest_instances.find((row) => row.due_date === previous);
    assert.equal(unfinished.status, 'available', label);
    assert.equal(store.xp_ledger.length, 0, label);
    assert.equal(openBoard(store, late), current, label);
    assert.equal(store.quest_instances.find((row) => row.id === unfinished.id).status, 'available', label);
    assert.equal(store.quest_instances.find((row) => row.id === unfinished.id).due_date, previous, label);
    assert.equal(store.xp_ledger.length, 0, label);
    const opened = store.quest_instances.find((row) => row.due_date === current);
    assert.equal(opened.status, 'available', label);
    assert.notEqual(opened.id, unfinished.id, label);
  }
});

test('(d) XP is not awarded twice for the same daily instance across 5:00', async () => {
  for (const [label, year, month, day, previous, current] of mornings) {
    const store = freshStore();
    const early = onlyInstant(year, month, day, 4, 59);
    const late = onlyInstant(year, month, day, 5, 0);
    const first = await submit(store, early);
    assert.equal(first.ok, true, label);
    const instanceId = first.result.instance_id;
    assert.equal(store.quest_instances.find((row) => row.id === instanceId).due_date, previous, label);
    assert.equal(xpFor(store, instanceId), 1, label);

    const repeatedEarly = await submit(store, early);
    assert.equal(repeatedEarly.ok, true, label);
    assert.equal(repeatedEarly.result.instance_id, instanceId, label);
    assert.equal(xpFor(store, instanceId), 1, label);

    const sameAfterRollover = await submit(store, late, previous);
    assert.equal(sameAfterRollover.ok, true, label);
    assert.equal(sameAfterRollover.result.instance_id, instanceId, label);
    assert.equal(xpFor(store, instanceId), 1, label);
    for (let call = 0; call < 3; call += 1) {
      const again = await submit(store, late, previous);
      assert.equal(again.ok, true, `${label} repeat ${call}`);
      assert.equal(again.result.instance_id, instanceId, label);
    }
    assert.equal(completeInstance(store, instanceId).awarded, false, label);
    assert.equal(xpFor(store, instanceId), 1, label);
    assert.equal(store.xp_ledger.length, 1, label);
    assert.equal(store.quest_instances.filter((row) => row.due_date === previous).length, 1, label);
    assert.equal(store.quest_instances.some((row) => row.due_date === current && row.status === 'completed'), false, label);

    openBoard(store, late);
    const nextDay = store.quest_instances.find((row) => row.due_date === current);
    assert.equal(nextDay.status, 'available', label);
    assert.equal(xpFor(store, nextDay.id), 0, label);
    assert.equal(store.xp_ledger.length, 1, label);
  }
});

test('(e) quest day is deterministic from instant and timezone for client and server', () => {
  const samples = [];
  for (const [, year, month, day] of mornings) {
    for (const [hour, minute] of [[1, 0], [3, 0], [4, 59], [5, 0]]) {
      if (year === 2026 && month === 3 && day === 8 && hour === 2) continue;
      const hits = instantsAtChicago(year, month, day, hour, minute);
      assert.ok(hits.length >= 1);
      for (const instant of hits) samples.push(instant.toISOString());
    }
  }
  const fallOnes = instantsAtChicago(2026, 11, 1, 1, 30).map((instant) => instant.toISOString());
  assert.equal(fallOnes.length, 2);
  for (const isoTime of [...samples, ...fallOnes]) {
    const instant = new Date(isoTime);
    const first = clientQuestDay(instant, CHICAGO);
    const second = serverQuestDay(instant, CHICAGO);
    assert.equal(first, second, isoTime);
    assert.equal(clientQuestDay(instant, CHICAGO), first, isoTime);
    assert.equal(serverQuestDay(new Date(instant.getTime()), CHICAGO), first, isoTime);
  }

  const moduleUrl = new URL('../lib/questDay.ts', import.meta.url).href;
  const script = `
    import { questDay } from ${JSON.stringify(moduleUrl)};
    const samples = ${JSON.stringify(samples.concat(fallOnes))};
    const out = samples.map((isoTime) => questDay(new Date(isoTime), ${JSON.stringify(CHICAGO)}));
    process.stdout.write(JSON.stringify(out));
  `;
  const expected = samples.concat(fallOnes).map((isoTime) => clientQuestDay(new Date(isoTime), CHICAGO));
  for (const hostTz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ: hostTz },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const json = result.stdout.slice(result.stdout.indexOf('['));
    assert.deepEqual(JSON.parse(json), expected, hostTz);
  }

  const page = readFileSync(join(root, 'app/page.tsx'), 'utf8');
  const route = readFileSync(join(root, 'app/api/mcp/route.ts'), 'utf8');
  assert.match(page, /questDay/);
  assert.match(route, /questDay: questDay\(now\)/);
  assert.match(page, /from '\.\.\/lib\/questDay'/);
  assert.match(route, /from '\.\.\/\.\.\/\.\.\/lib\/questDay'/);
});

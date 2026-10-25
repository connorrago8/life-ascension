import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chicagoToday } from '../lib/chicagoDate.ts';
import { QUEST_DOMAINS } from '../lib/domains.ts';
import {
  acceptSuggestedQuest,
  countQuestsEver,
  hasOnboardedStamp,
  isOnboardingPreview,
  readPreviewStep,
  shouldShowOnboarding,
} from '../lib/onboarding.ts';
import { QUEST_TEMPLATES, selectSuggestedQuests } from '../lib/questTemplates.ts';

const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const onboarding = readFileSync(new URL('../lib/onboarding.ts', import.meta.url), 'utf8');
const templates = readFileSync(new URL('../lib/questTemplates.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../app/onboarding/ui.tsx', import.meta.url), 'utf8');
const coreSql = readFileSync(new URL('../supabase/migrations/202610230001_core.sql', import.meta.url), 'utf8');
const createSql = readFileSync(new URL('../supabase/migrations/202610240007_daily_late_window.sql', import.meta.url), 'utf8');

const xpRpc = /rpc\(\s*['"](?:set_quest_instance_status|set_quest_instance_status_as_user|get_lifetime_xp|get_lifetime_xp_as_user|add_quest_progress|add_quest_progress_as_user)/;

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

function fakeClient(rows, options = {}) {
  const rpcs = [];
  const updates = [];
  const queries = [];
  const client = {
    rpcs,
    updates,
    queries,
    from(table) {
      assert.equal(table, 'quests');
      const state = { head: false, filters: [] };
      const builder = {
        select(_columns, opts) {
          state.head = Boolean(opts && opts.head);
          return builder;
        },
        eq(column, value) {
          state.filters.push([column, value]);
          return builder;
        },
        then(onfulfilled, onrejected) {
          const matched = rows.filter((row) => state.filters.every(([column, value]) => row[column] === value));
          queries.push({ head: state.head, filters: state.filters.slice(), matched: matched.length });
          const value = state.head
            ? { data: null, error: null, count: matched.length }
            : { data: matched, error: null, count: matched.length };
          return Promise.resolve(value).then(onfulfilled, onrejected);
        },
      };
      return builder;
    },
    rpc(fn, args) {
      rpcs.push({ fn, args });
      if (options.rpcError) return Promise.resolve({ data: null, error: { message: options.rpcError } });
      const id = `quest-${rows.length + 1}`;
      rows.push({ id, title: args.p_title, owner_id: 'user-1', active: true });
      return Promise.resolve({ data: id, error: null });
    },
    auth: {
      updateUser(input) {
        updates.push(input);
        return Promise.resolve({ data: {}, error: options.stampError ? { message: options.stampError } : null });
      },
    },
  };
  return client;
}

test('a new player with no stamp and zero quests sees onboarding', () => {
  assert.equal(shouldShowOnboarding({ onboardedAt: undefined, questCountEver: 0 }), true);
  assert.equal(shouldShowOnboarding({ onboardedAt: null, questCountEver: 0 }), true);
  assert.equal(shouldShowOnboarding({ onboardedAt: '   ', questCountEver: 0 }), true);
  assert.equal(hasOnboardedStamp(''), false);
});

test('accepting one quest then leaving hides onboarding even without onboarded_at', () => {
  assert.equal(shouldShowOnboarding({ onboardedAt: undefined, questCountEver: 1 }), false);
});

test('closing before accepting anything shows onboarding again', () => {
  assert.equal(shouldShowOnboarding({ onboardedAt: undefined, questCountEver: 0 }), true);
});

test('onboarded_at set on another device hides onboarding with or without quests', () => {
  const stamp = '2026-10-25T18:00:00.000Z';
  assert.equal(shouldShowOnboarding({ onboardedAt: stamp, questCountEver: 0 }), false);
  assert.equal(shouldShowOnboarding({ onboardedAt: stamp, questCountEver: 4 }), false);
});

test('an unknown quest count is not treated as a new player', () => {
  assert.equal(shouldShowOnboarding({ onboardedAt: undefined, questCountEver: Number.NaN }), false);
  assert.equal(shouldShowOnboarding({ onboardedAt: undefined, questCountEver: -1 }), false);
});

test('archived quests count, and the count does not filter active', async () => {
  const rows = [
    { id: 'a', title: 'Old', owner_id: 'user-1', active: false },
    { id: 'b', title: 'Other', owner_id: 'user-2', active: false },
  ];
  const client = fakeClient(rows);
  const count = await countQuestsEver(client, 'user-1');
  assert.equal(count, 1);
  assert.equal(client.queries.some((query) => query.filters.some(([column]) => column === 'active')), false);
  assert.deepEqual(client.queries[0].filters, [['owner_id', 'user-1']]);
  assert.equal(shouldShowOnboarding({ onboardedAt: undefined, questCountEver: count }), false);
});

test('hard-deleted quests leave no row, so onboarded_at is the backstop', () => {
  assert.equal(shouldShowOnboarding({ onboardedAt: '2026-10-25T18:00:00.000Z', questCountEver: 0 }), false);
  assert.equal(shouldShowOnboarding({ onboardedAt: undefined, questCountEver: 0 }), true);
});

test('preview=1 is dev-only and production ignores it', () => {
  assert.equal(isOnboardingPreview('?preview=1', 'development'), true);
  assert.equal(isOnboardingPreview('preview=1', 'test'), true);
  assert.equal(isOnboardingPreview('?preview=1', 'production'), false);
  assert.equal(isOnboardingPreview('?preview=true', 'development'), false);
  assert.equal(isOnboardingPreview('', 'development'), false);
  assert.equal(readPreviewStep('?preview=1&step=quests'), 'quests');
  assert.equal(readPreviewStep('?preview=1&step=board'), 'board');
  assert.equal(readPreviewStep('?preview=1&step=nope'), 'welcome');
  assert.match(page, /isOnboardingPreview\(window\.location\.search, process\.env\.NODE_ENV\)/);
});

test('starter templates stay inside the quest fields the RPC accepts', () => {
  assert.ok(QUEST_TEMPLATES.length >= 10 && QUEST_TEMPLATES.length <= 15);
  const ids = new Set(QUEST_TEMPLATES.map((template) => template.id));
  const titles = new Set(QUEST_TEMPLATES.map((template) => template.title));
  assert.equal(ids.size, QUEST_TEMPLATES.length);
  assert.equal(titles.size, QUEST_TEMPLATES.length);
  for (const template of QUEST_TEMPLATES) {
    assert.ok(template.title.trim().length >= 1 && template.title.trim().length <= 120);
    assert.ok(template.description.trim().length > 0);
    assert.ok(template.cadence === 'once' || template.cadence === 'daily');
    assert.ok(QUEST_DOMAINS.includes(template.focus));
  }
  assert.match(coreSql, /check\(cadence in \('once','daily'\)\)/);
  assert.match(createSql, /if p_cadence not in \('once','daily'\)/);
});

test('template selection is always three quests and deterministic', () => {
  const focusLists = [[], ['physical_health'], ['home', 'finance'], ['career'], ['home', 'home', 'finance', 'hygiene', 'career']];
  for (const focus of focusLists) {
    const first = selectSuggestedQuests(focus);
    const second = selectSuggestedQuests(focus);
    assert.equal(first.length, 3);
    assert.deepEqual(first.map((template) => template.id), second.map((template) => template.id));
  }
});

test('template selection stays inside the chosen focus when that focus can fill three quests', () => {
  const fitness = selectSuggestedQuests(['physical_health']);
  assert.deepEqual(fitness.map((template) => template.id), ['walk-10', 'squats-10', 'stretch-5']);
  assert.ok(fitness.every((template) => template.focus === 'physical_health'));

  const mixed = selectSuggestedQuests(['home', 'finance']);
  assert.deepEqual(mixed.map((template) => template.id), ['make-bed', 'track-spending', 'clear-surface']);
  assert.ok(mixed.every((template) => template.focus === 'home' || template.focus === 'finance'));
});

test('a thin focus still returns three quests, in a stable order, and extra focuses are ignored', () => {
  assert.deepEqual(selectSuggestedQuests(['career']).map((template) => template.id), ['top-task', 'walk-10', 'squats-10']);
  assert.deepEqual(selectSuggestedQuests(['career', 'hygiene', 'finance', 'home']).map((template) => template.id), ['top-task', 'brush-teeth', 'track-spending']);
  assert.deepEqual(selectSuggestedQuests(['nope', 'home']).map((template) => template.focus), ['home', 'home', 'home']);
  assert.deepEqual(selectSuggestedQuests([]).map((template) => template.id), ['walk-10', 'squats-10', 'stretch-5']);
});

test('accepting a suggestion calls create_scheduled_quest only, for Chicago today, and stamps onboarded_at', async () => {
  const rows = [];
  const client = fakeClient(rows);
  const template = QUEST_TEMPLATES[0];
  const result = await acceptSuggestedQuest(client, {
    userId: 'user-1',
    template,
    today: '2026-10-25',
    claimed: new Set(),
    storage: memoryStorage(),
  });
  assert.equal(result.status, 'created');
  assert.deepEqual(client.rpcs.map((call) => call.fn), ['create_scheduled_quest']);
  assert.deepEqual(client.rpcs[0].args, {
    p_title: template.title,
    p_domain: template.focus,
    p_cadence: template.cadence,
    p_date: '2026-10-25',
    p_quest_type: 'scheduled',
  });
  assert.equal('p_owner_id' in client.rpcs[0].args, false);
  assert.equal(client.updates.length, 1);
  assert.equal(typeof client.updates[0].data.onboarded_at, 'string');
  assert.equal(client.queries.some((query) => query.filters.some(([column]) => column === 'active')), false);
});

test('onboarding code never calls an XP or completion RPC', async () => {
  const rows = [];
  const client = fakeClient(rows);
  await acceptSuggestedQuest(client, {
    userId: 'user-1',
    template: QUEST_TEMPLATES[3],
    today: '2026-10-25',
    claimed: new Set(),
    storage: memoryStorage(),
  });
  assert.equal(client.rpcs.some((call) => xpRpc.test(`rpc('${call.fn}'`)), false);
  for (const source of [onboarding, ui, templates]) {
    assert.doesNotMatch(source, xpRpc);
  }
  const rpcCalls = onboarding.match(/rpc\(\s*['"][^'"]+['"]/g);
  assert.deepEqual(rpcCalls, ["rpc('create_scheduled_quest'"]);
  const skipStart = ui.indexOf('function skipCard');
  const skipEnd = ui.indexOf('function acceptCard');
  assert.ok(skipStart >= 0 && skipEnd > skipStart);
  assert.doesNotMatch(ui.slice(skipStart, skipEnd), /rpc|supabase|updateUser|create_scheduled_quest|fetch\(/);
  assert.match(page, /create_scheduled_quest/);
  assert.match(page, /id="create-quest"/);
});

test('a second accept of the same template does not create another quest', async () => {
  const rows = [];
  const client = fakeClient(rows);
  const storage = memoryStorage();
  const claimed = new Set();
  const input = { userId: 'user-1', template: QUEST_TEMPLATES[0], today: '2026-10-25', claimed, storage };
  const first = acceptSuggestedQuest(client, input);
  const second = await acceptSuggestedQuest(client, input);
  assert.equal(second.status, 'duplicate');
  const created = await first;
  assert.equal(created.status, 'created');
  assert.equal(client.rpcs.length, 1);

  const otherTab = fakeClient(rows);
  const again = await acceptSuggestedQuest(otherTab, {
    userId: 'user-1',
    template: QUEST_TEMPLATES[0],
    today: '2026-10-25',
    claimed: new Set(),
    storage: memoryStorage(),
  });
  assert.equal(again.status, 'duplicate');
  assert.equal(otherTab.rpcs.length, 0);
});

test('an archived quest with the same title blocks a duplicate create', async () => {
  const rows = [{ id: 'old', title: QUEST_TEMPLATES[1].title, owner_id: 'user-1', active: false }];
  const client = fakeClient(rows);
  const result = await acceptSuggestedQuest(client, {
    userId: 'user-1',
    template: QUEST_TEMPLATES[1],
    today: '2026-10-25',
    claimed: new Set(),
    storage: memoryStorage(),
  });
  assert.equal(result.status, 'duplicate');
  assert.equal(client.rpcs.length, 0);
  assert.equal(rows.length, 1);
});

test('a same-browser claim stops a second tab before the RPC', async () => {
  const storage = memoryStorage();
  storage.setItem('life-ascension:onboarding-accept:user-1:walk-10', 'pending');
  const client = fakeClient([]);
  const result = await acceptSuggestedQuest(client, {
    userId: 'user-1',
    template: QUEST_TEMPLATES[0],
    today: '2026-10-25',
    claimed: new Set(),
    storage,
  });
  assert.equal(result.status, 'duplicate');
  assert.equal(client.rpcs.length, 0);
});

test('a failed create releases the claim so the player can retry', async () => {
  const client = fakeClient([], { rpcError: 'Date out of range' });
  const storage = memoryStorage();
  const claimed = new Set();
  const input = { userId: 'user-1', template: QUEST_TEMPLATES[0], today: '2026-10-25', claimed, storage };
  const failed = await acceptSuggestedQuest(client, input);
  assert.equal(failed.status, 'error');
  assert.equal(claimed.has('walk-10'), false);
  assert.equal(storage.getItem('life-ascension:onboarding-accept:user-1:walk-10'), null);
});

test('a cadence the RPC rejects is not sent', async () => {
  const client = fakeClient([]);
  const result = await acceptSuggestedQuest(client, {
    userId: 'user-1',
    template: { ...QUEST_TEMPLATES[0], cadence: 'weekly' },
    today: '2026-10-25',
    claimed: new Set(),
    storage: memoryStorage(),
  });
  assert.equal(result.status, 'invalid');
  assert.equal(client.rpcs.length, 0);
  assert.equal(client.updates.length, 0);
});

test('create_scheduled_quest has no title idempotency, so overlapping accepts can still duplicate', () => {
  const start = createSql.indexOf('function public.create_scheduled_quest');
  const end = createSql.indexOf('function public.ensure_quest_instance');
  assert.ok(start >= 0 && end > start);
  const createFn = createSql.slice(start, end);
  assert.match(createFn, /insert into public\.quests\(owner_id,title,domain,cadence,scheduled_for,quest_type\)/);
  assert.doesNotMatch(createFn, /on conflict/i);
  assert.match(coreSql, /unique\(id,owner_id\)/);
  assert.doesNotMatch(coreSql, /unique\s*\(\s*owner_id\s*,\s*title/i);
  assert.match(onboarding, /can still store two quests with the same title/);
});

test('Chicago dates stay on the Chicago calendar day', () => {
  assert.equal(chicagoToday(new Date('2026-10-26T04:30:00.000Z')), '2026-10-25');
  assert.equal(chicagoToday(new Date('2026-10-26T05:00:00.000Z')), '2026-10-26');
});

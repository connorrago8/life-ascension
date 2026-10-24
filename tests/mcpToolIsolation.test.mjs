import assert from 'node:assert/strict';
import test from 'node:test';
import { runMcpTool } from '../lib/mcpTools.ts';

const alice = '00000000-0000-0000-0000-0000000000e1';
const bob = '00000000-0000-0000-0000-0000000000e2';
const today = '2026-10-24';

function seed() {
  const tables = {
    quests: [
      { id: 'aq-active', owner_id: alice, title: 'Alice active', domain: 'home', cadence: 'once', quest_type: 'goal', scheduled_for: today, active: true },
      { id: 'aq-archived', owner_id: alice, title: 'Alice archived', domain: 'home', cadence: 'once', quest_type: 'scheduled', scheduled_for: today, active: false },
      { id: 'bq-active', owner_id: bob, title: 'Bob active', domain: 'home', cadence: 'once', quest_type: 'goal', scheduled_for: today, active: true },
    ],
    quest_instances: [
      { id: 'ai-active', quest_id: 'aq-active', owner_id: alice, due_date: today, status: 'available' },
      { id: 'ai-archived', quest_id: 'aq-archived', owner_id: alice, due_date: today, status: 'available' },
      { id: 'ai-old', quest_id: 'aq-active', owner_id: alice, due_date: '2026-10-01', status: 'completed' },
      { id: 'bi-active', quest_id: 'bq-active', owner_id: bob, due_date: today, status: 'completed' },
    ],
    quest_progress: [],
    xp_ledger: [
      { owner_id: alice, instance_id: 'ai-old', amount: 1 },
      { owner_id: bob, instance_id: 'bi-active', amount: 1 },
    ],
  };
  const calls = [];
  return { tables, calls, db: memoryDb(tables, calls) };
}

function memoryDb(tables, calls) {
  return {
    from(table) {
      return {
        select(columns, options) {
          return new Query(tables[table] ?? [], { table, columns, head: options?.head === true, count: options?.count === 'exact' }, calls);
        },
      };
    },
    async rpc(fn, args) {
      calls.push({ fn, args: { ...args } });
      const userId = args.p_user_id;
      if (fn === 'create_scheduled_quest_as_user') {
        const id = `created-${tables.quests.length + 1}`;
        tables.quests.push({
          id,
          owner_id: userId,
          title: args.p_title,
          domain: args.p_domain,
          cadence: args.p_cadence,
          quest_type: args.p_quest_type,
          scheduled_for: args.p_date,
          active: true,
        });
        tables.quest_instances.push({
          id: `inst-${id}`,
          quest_id: id,
          owner_id: userId,
          due_date: args.p_date,
          status: 'available',
        });
        return { data: id, error: null };
      }
      if (fn === 'add_quest_progress_as_user') {
        const quest = tables.quests.find((row) => row.id === args.p_quest_id && row.owner_id === userId);
        if (!quest) return { data: null, error: { message: 'Quest not found' } };
        if (args.p_instance_id) {
          const instance = tables.quest_instances.find((row) => row.id === args.p_instance_id && row.owner_id === userId && row.quest_id === quest.id);
          if (!instance) return { data: null, error: { message: 'Instance not found' } };
        }
        const id = `note-${tables.quest_progress.length + 1}`;
        tables.quest_progress.push({ id, user_id: userId, quest_id: quest.id, note: args.p_note });
        return { data: id, error: null };
      }
      if (fn === 'set_quest_instance_status_as_user') {
        const instance = tables.quest_instances.find((row) => row.id === args.p_instance_id && row.owner_id === userId);
        if (!instance) return { data: null, error: { message: 'Instance not found' } };
        const quest = tables.quests.find((row) => row.id === instance.quest_id && row.owner_id === userId);
        if (!quest?.active) return { data: null, error: { message: 'Active quest not found' } };
        if (instance.status !== 'completed') {
          instance.status = 'completed';
          tables.xp_ledger.push({ owner_id: userId, instance_id: instance.id, amount: 1 });
        }
        return { data: 'completed', error: null };
      }
      if (fn === 'ensure_quest_instance_as_user') {
        const quest = tables.quests.find((row) => row.id === args.p_quest_id && row.owner_id === userId && row.active);
        if (!quest) return { data: null, error: { message: 'Quest not found' } };
        const id = `ensured-${args.p_quest_id}`;
        tables.quest_instances.push({ id, quest_id: quest.id, owner_id: userId, due_date: args.p_date, status: 'available' });
        return { data: id, error: null };
      }
      if (fn === 'get_lifetime_xp_as_user') {
        const total = tables.xp_ledger.filter((row) => row.owner_id === userId).reduce((sum, row) => sum + row.amount, 0);
        return { data: total, error: null };
      }
      return { data: null, error: { message: `unexpected rpc ${fn}` } };
    },
  };
}

class Query {
  constructor(rows, meta, calls) {
    this.rows = rows;
    this.meta = meta;
    this.calls = calls;
    this.filters = [];
    this.limitN = null;
    this.single = false;
  }

  eq(column, value) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ op: 'in', column, values: [...values] });
    return this;
  }

  limit(count) {
    this.limitN = count;
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
    this.calls.push({ table: this.meta.table, filters: this.filters.map((filter) => ({ ...filter })) });
    let rows = this.rows.filter((row) => this.filters.every((filter) => {
      if (filter.op === 'eq') return row[filter.column] === filter.value;
      return filter.values.includes(row[filter.column]);
    }));
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    if (this.meta.head) return { data: null, error: null, count: rows.length };
    if (this.single) {
      if (rows.length > 1) return { data: null, error: { message: 'multiple rows' } };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

function asAlice(db, name, args) {
  return runMcpTool({ db, userId: alice, method: 'api_key', name, args, today });
}

test('list_quests hides inactive instances and the other user', async () => {
  const { db } = seed();
  const listed = await asAlice(db, 'list_quests', { include_history: true });
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.result.quests.map((quest) => quest.id), ['aq-active']);
  assert.deepEqual(listed.result.instances.map((instance) => instance.id).sort(), ['ai-active', 'ai-old']);
  const todayOnly = await asAlice(db, 'list_quests', {});
  assert.deepEqual(todayOnly.result.instances.map((instance) => instance.id), ['ai-active']);
});

test('an API key cannot read, note, complete, or create the other user rows', async () => {
  const { tables, calls, db } = seed();
  const progress = await asAlice(db, 'update_progress', { quest_id: 'bq-active', note: 'stolen' });
  assert.equal(progress.ok, false);
  assert.equal(progress.message, 'Quest not found');
  assert.equal(tables.quest_progress.length, 0);

  const complete = await asAlice(db, 'submit_completion', { quest_id: 'bq-active', confirmed_complete: true });
  assert.equal(complete.ok, false);
  assert.equal(complete.message, 'Quest not found');
  assert.equal(tables.quest_instances.find((row) => row.id === 'bi-active').status, 'completed');
  assert.equal(tables.xp_ledger.filter((row) => row.owner_id === bob).length, 1);

  const created = await asAlice(db, 'create_quest', { title: 'Alice chore', domain: 'home', cadence: 'once', quest_type: 'scheduled', due_date: '2026-10-29' });
  assert.equal(created.ok, true);
  assert.equal(tables.quests.find((row) => row.id === created.result.id).owner_id, alice);
  assert.equal(calls.some((call) => call.fn === 'create_scheduled_quest_as_user' && call.args.p_user_id === alice), true);
  assert.equal(calls.some((call) => call.args?.p_user_id === bob), false);

  const ownNote = await asAlice(db, 'update_progress', { quest_id: 'aq-active', note: 'Still mine' });
  assert.equal(ownNote.ok, true);
  assert.equal(ownNote.result.xp_awarded, false);
  assert.equal(tables.quest_progress.length, 1);
  assert.equal(tables.quest_progress[0].user_id, alice);

  const progressView = await asAlice(db, 'get_character_progress', {});
  assert.equal(progressView.ok, true);
  assert.equal(progressView.result.lifetime_xp, 1);
  assert.equal(progressView.result.completed_instances, 1);
  assert.equal('quests' in progressView.result, false);
  assert.equal(calls.some((call) => call.fn === 'get_lifetime_xp_as_user' && call.args.p_user_id === alice), true);
});

test('Bob is isolated from Alice the same way', async () => {
  const { tables, db } = seed();
  const listed = await runMcpTool({ db, userId: bob, method: 'api_key', name: 'list_quests', args: { include_history: true }, today });
  assert.deepEqual(listed.result.quests.map((quest) => quest.id), ['bq-active']);
  assert.deepEqual(listed.result.instances.map((instance) => instance.id), ['bi-active']);
  const note = await runMcpTool({ db, userId: bob, method: 'api_key', name: 'update_progress', args: { quest_id: 'aq-active', note: 'nope' }, today });
  assert.equal(note.ok, false);
  assert.equal(tables.quest_progress.length, 0);
  const complete = await runMcpTool({
    db,
    userId: bob,
    method: 'api_key',
    name: 'submit_completion',
    args: { quest_id: 'aq-active', confirmed_complete: true },
    today,
  });
  assert.equal(complete.ok, false);
  assert.equal(tables.quest_instances.find((row) => row.id === 'ai-active').status, 'available');
});

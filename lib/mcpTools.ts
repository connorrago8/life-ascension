export const mcpDomains = ['hygiene', 'home', 'mental_health', 'personal_growth', 'finance', 'career', 'relationships', 'physical_health'];
const sources = ['web', 'chatgpt', 'grok', 'api'];

type RpcResult = { data: unknown; error: { message: string } | null; count?: number | null };

// The Supabase client is passed through as a structural query builder. Typing it
// against SupabaseClient makes the route's generic instantiation blow up.

export type ToolSuccess = { ok: true; result: unknown };
export type ToolFailure = { ok: false; rpcCode: number; message: string };
export type ToolOutcome = ToolSuccess | ToolFailure;

type ToolInput = {
  db: any;
  userId: string;
  method: 'api_key' | 'supabase_jwt';
  name: string;
  args: Record<string, unknown>;
  today: string;
};

export async function runMcpTool(input: ToolInput): Promise<ToolOutcome> {
  const { db, userId, name, args, today } = input;
  const bad = (message: string): ToolFailure => ({ ok: false, rpcCode: -32602, message });
  const crashed = (message: string): ToolFailure => ({ ok: false, rpcCode: -32000, message });

  if (name === 'create_quest') {
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    const questType = args.quest_type === undefined ? 'scheduled' : args.quest_type;
    if (!title || title.length > 120 || !mcpDomains.includes(String(args.domain)) || !['once', 'daily'].includes(String(args.cadence))) return bad('Invalid quest fields');
    if (questType !== 'scheduled' && questType !== 'goal') return bad('Invalid quest type');
    if (questType === 'goal' && args.cadence !== 'once') return bad('Goals are one-time');
    if (args.due_date !== undefined && !isoDate(args.due_date)) return bad('Invalid due date');
    const date = typeof args.due_date === 'string' ? args.due_date : today;
    const created = await userRpc(input, 'create_scheduled_quest', 'create_scheduled_quest_as_user', {
      p_title: title,
      p_domain: args.domain,
      p_cadence: args.cadence,
      p_date: date,
      p_quest_type: questType,
    });
    if (created.error || typeof created.data !== 'string') return crashed(created.error?.message || 'Quest was not created');
    const instance = await db.from('quest_instances').select('id,due_date').eq('quest_id', created.data).eq('owner_id', userId).maybeSingle();
    if (instance.error) return crashed(instance.error.message);
    const row = instance.data as { due_date?: unknown; id?: unknown } | null;
    return {
      ok: true,
      result: {
        id: created.data,
        title,
        domain: args.domain,
        cadence: args.cadence,
        quest_type: questType,
        due_date: typeof row?.due_date === 'string' ? row.due_date : date,
        instance_id: typeof row?.id === 'string' ? row.id : null,
      },
    };
  }

  if (name === 'update_progress') {
    if (typeof args.quest_id !== 'string' || typeof args.note !== 'string') return bad('Quest ID and a progress note are required');
    const note = args.note.trim();
    if (!note || note.length > 1000) return bad('Note must be 1 to 1000 characters');
    const percent = parsePercent(args.percent);
    if (percent === 'invalid') return bad('Percent must be an integer from 0 to 100');
    if (args.instance_id !== undefined && typeof args.instance_id !== 'string') return bad('Invalid instance ID');
    const source = typeof args.source === 'string' && sources.includes(args.source) ? args.source : 'api';
    const saved = await userRpc(input, 'add_quest_progress', 'add_quest_progress_as_user', {
      p_quest_id: args.quest_id,
      p_note: note,
      p_percent: percent,
      p_instance_id: typeof args.instance_id === 'string' ? args.instance_id : null,
      p_source: source,
    });
    if (saved.error || typeof saved.data !== 'string') return crashed(saved.error?.message || 'Progress note was not saved');
    return { ok: true, result: { id: saved.data, quest_id: args.quest_id, saved: true, xp_awarded: false } };
  }

  if (name === 'log_quest_progress') {
    if (typeof args.instance_id !== 'string' || typeof args.request_id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.instance_id)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.request_id)
      || typeof args.delta !== 'number' || !Number.isInteger(args.delta) || args.delta === 0
      || Math.abs(args.delta) > 1000000) return bad('Valid instance_id, request_id UUID, and nonzero integer delta are required');
    const saved = await userRpc(input, 'log_quest_progress', 'log_quest_progress_as_user', {
      p_instance_id: args.instance_id,
      p_request_id: args.request_id,
      p_delta: args.delta,
    });
    if (saved.error) return crashed(saved.error.message);
    const row = Array.isArray(saved.data) ? saved.data[0] : saved.data;
    return {ok:true,result:{instance_id:args.instance_id,request_id:args.request_id,...(row && typeof row==='object'?row:{})}};
  }

  if (name === 'submit_completion') {
    if (typeof args.quest_id !== 'string' || args.confirmed_complete !== true) return bad('Quest ID and explicit confirmed_complete=true required');
    if (args.due_date !== undefined && !isoDate(args.due_date)) return bad('Invalid due date');
    const quest = await db.from('quests').select('id,cadence,quest_type,scheduled_for,active').eq('id', args.quest_id).eq('owner_id', userId).maybeSingle();
    if (quest.error) return crashed(quest.error.message);
    const questRow = quest.data as { id?: unknown; cadence?: unknown; scheduled_for?: unknown; active?: unknown } | null;
    if (!questRow || questRow.active !== true || typeof questRow.id !== 'string') return bad('Quest not found');
    const date = typeof args.due_date === 'string'
      ? args.due_date
      : questRow.cadence === 'once' && typeof questRow.scheduled_for === 'string'
        ? questRow.scheduled_for
        : today;
    const existing = await db.from('quest_instances').select('id').eq('owner_id', userId).eq('quest_id', questRow.id).eq('due_date', date).maybeSingle();
    if (existing.error) return crashed(existing.error.message);
    const existingRow = existing.data as { id?: unknown } | null;
    let instanceId = typeof existingRow?.id === 'string' ? existingRow.id : null;
    if (!instanceId) {
      const ensured = await userRpc(input, 'ensure_quest_instance', 'ensure_quest_instance_as_user', {
        p_quest_id: questRow.id,
        p_date: date,
      });
      if (ensured.error || typeof ensured.data !== 'string') return crashed(ensured.error?.message || 'Instance was not created');
      instanceId = ensured.data;
    }
    const completed = await userRpc(input, 'set_quest_instance_status', 'set_quest_instance_status_as_user', {
      p_instance_id: instanceId,
      p_action: 'complete',
    });
    if (completed.error) return crashed(completed.error.message);
    return {
      ok: true,
      result: { quest_id: questRow.id, instance_id: instanceId, recorded: completed.data === 'completed', server_result: completed.data },
    };
  }

  if (name === 'list_quests') {
    const date = args.due_date === undefined ? today : args.due_date;
    if (!isoDate(date)) return bad('Invalid due date');
    const questRows = await db.from('quests').select('id,title,domain,cadence,quest_type,scheduled_for,active,target_amount,progress_unit,progress_increment').eq('owner_id', userId).eq('active', true);
    if (questRows.error) return crashed(questRows.error.message);
    const activeIds = (Array.isArray(questRows.data) ? questRows.data : [])
      .map((quest: { id?: unknown } | null) => (quest && typeof quest === 'object' ? quest.id : null))
      .filter((id: unknown): id is string => typeof id === 'string');
    let instanceData: unknown[] = [];
    if (activeIds.length > 0) {
      let instances = db.from('quest_instances').select('id,quest_id,due_date,status,current_amount').eq('owner_id', userId).in('quest_id', activeIds);
      if (args.include_history !== true) instances = instances.eq('due_date', date);
      const instanceRows = await instances.limit(500);
      if (instanceRows.error) return crashed(instanceRows.error.message);
      instanceData = Array.isArray(instanceRows.data) ? instanceRows.data : [];
    }
    return { ok: true, result: { quests: questRows.data ?? [], instances: instanceData } };
  }

  if (name === 'get_character_progress') {
    const [xp, completed] = await Promise.all([
      userRpc(input, 'get_lifetime_xp', 'get_lifetime_xp_as_user', {}),
      db.from('quest_instances').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('status', 'completed'),
    ]);
    if (xp.error || completed.error) return crashed(xp.error?.message || completed.error?.message || 'Query failed');
    return { ok: true, result: { lifetime_xp: Number(xp.data ?? 0), completed_instances: completed.count ?? 0 } };
  }

  return bad('Unknown tool');
}

async function userRpc(input: ToolInput, name: string, asUserName: string, args: Record<string, unknown>): Promise<RpcResult> {
  const query = input.method === 'api_key'
    ? input.db.rpc(asUserName, { ...args, p_user_id: input.userId })
    : input.db.rpc(name, args);
  return await query;
}

function isoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parsePercent(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) return 'invalid';
  return value;
}

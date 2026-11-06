/** Local test gateway only: compile the precise Home API surface to real RLS queries. */
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;
function checked(value, pattern) {
 if (!pattern.test(value)) throw Error('Unsupported fixture filter');
 return literal(value);
}
export function homeFixtureSql(method, url, data = {}) {
 const path = url.pathname;
 if (method === 'POST') {
  const name = path.replace('/rest/v1/rpc/', '');
  const signatures = {
   get_lifetime_xp: [],
   create_scheduled_quest: ['p_title', 'p_domain', 'p_cadence', 'p_date', 'p_quest_type'],
   ensure_quest_instance: ['p_quest_id', 'p_date'],
   set_quest_instance_status: ['p_instance_id', 'p_action'],
  };
  if (!path.startsWith('/rest/v1/rpc/') || !Object.hasOwn(signatures, name)) throw Error('No test route');
  const keys = signatures[name];
  if (!data || Object.keys(data).some(k => !keys.includes(k)) || keys.some(k => typeof data[k] !== 'string')) throw Error('Invalid fixture arguments');
  return `select to_jsonb(public.${name}(${keys.map(k => `${k} => ${literal(data[k])}`).join(',')}));`;
 }
 if (method !== 'GET') throw Error('No test route');
 const table = path.slice('/rest/v1/'.length);
 const columns = {
  quests: ['id','title','domain','cadence','created_at','scheduled_for','quest_type'],
  quest_instances: ['id','quest_id','due_date','status'],
 };
 if (!path.startsWith('/rest/v1/') || !Object.hasOwn(columns, table)) throw Error('No test route');
 const selected = (url.searchParams.get('select') || '').split(',');
 if (!selected.length || selected.some(c => !columns[table].includes(c))) throw Error('Unsupported fixture columns');
 const where = [];
 let order = '', limit = 1000;
 for (const [key, value] of url.searchParams) {
  if (key === 'select') continue;
  if (key === 'order' && table === 'quests' && value === 'created_at.asc') { order = 'order by created_at asc'; continue; }
  if (key === 'limit' && /^\d+$/.test(value) && Number(value) <= 1000) { limit = Number(value); continue; }
  if (key === 'active' && table === 'quests' && value === 'eq.true') { where.push('active = true'); continue; }
  if (key === 'owner_id' && value.startsWith('eq.')) { where.push(`owner_id = ${checked(value.slice(3), uuid)}::uuid`); continue; }
  if (key === 'due_date' && table === 'quest_instances' && /^(eq|lte)\./.test(value)) { where.push(`due_date ${value.startsWith('eq.') ? '=' : '<='} ${checked(value.split('.').slice(1).join('.'), date)}::date`); continue; }
  if (key === 'status' && table === 'quest_instances' && value === 'neq.completed') { where.push("status <> 'completed'"); continue; }
  if (key === 'quest_id' && table === 'quest_instances' && value.startsWith('in.(') && value.endsWith(')')) {
   const ids = value.slice(4,-1).split(',');
   if (ids.length > 1000) throw Error('Too many fixture IDs');
   where.push(`quest_id in (${ids.map(id => checked(id, uuid)+'::uuid').join(',')})`); continue;
  }
  throw Error('Unsupported fixture filter');
 }
 return `select coalesce(jsonb_agg(to_jsonb(row)), '[]'::jsonb) from (select ${selected.join(',')} from public.${table} ${where.length ? 'where '+where.join(' and ') : ''} ${order} limit ${limit}) row;`;
}

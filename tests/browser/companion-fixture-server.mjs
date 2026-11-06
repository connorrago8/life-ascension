/** Test-only auth identities; every RPC executes the actual migration in isolated PostgreSQL. */
import http from 'node:http';
import { homeFixtureSql } from './home-fixture-sql.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
if (!['localhost','127.0.0.1'].includes(process.env.PGHOST)) throw Error('Local PostgreSQL only');
export const FIXTURE_USERS = {
 connor: '00000000-0000-0000-0000-00000000ce01',
 izzy: '00000000-0000-0000-0000-00000000ce02',
 outsider: '00000000-0000-0000-0000-00000000ce03',
};
export function fixtureSession(name) {
 const user = { id: FIXTURE_USERS[name], aud: 'authenticated', role: 'authenticated', email: name+'@fixture.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
 const expires_at = 4102444800;
 const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
 return { user, access_token: [b64({ alg: 'HS256', typ: 'JWT' }),b64({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp: expires_at }), 'fixture-not-a-real-signature'].join('.'), refresh_token: 'fixture-not-a-real-refresh-token', expires_in: 3600, expires_at, token_type: 'bearer' };
}
const sessions = Object.keys(FIXTURE_USERS).map(fixtureSession);
const literal = text => "'"+text.replaceAll("'", "''")+"'";
const server = http.createServer(async (request,response) => {
 const origin = request.headers.origin;
 if (origin && origin !== 'http://127.0.0.1:3148') { response.writeHead(403).end(); return; }
 const headers = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin': 'http://127.0.0.1:3148', 'Access-Control-Allow-Headers': request.headers['access-control-request-headers'] || 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS' };
 const finish = (status,data) => { response.writeHead(status,headers); response.end(JSON.stringify(data)); };
 if (request.method==='OPTIONS') { finish(200,{}); return; }
 const session = sessions.find(s => request.headers.authorization === 'Bearer '+s.access_token);
 if (!session) { finish(401,{ message:'Unknown test identity' }); return; }
 const url = new URL(request.url,'http://127.0.0.1:54329');
 const path = url.pathname;
 if (request.method==='GET' && path==='/auth/v1/user') { finish(200,session.user); return; }
 if (!['GET','POST'].includes(request.method) || !path.startsWith('/rest/v1/')) { finish(404,{ message:'No test route' }); return; }
 try {
  let body=''; for await (const chunk of request) { body+=chunk; if(body.length>12000) throw Error('Request too large'); }
  const data=body ? JSON.parse(body) : {};
  let query;
  if (request.method==='POST' && ['/rest/v1/rpc/companion_command','/rest/v1/rpc/companion_activity'].includes(path)) {
  if(typeof data.p_action!=='string' || !data.p_payload || typeof data.p_payload!=='object' || Array.isArray(data.p_payload)) throw Error('Invalid request');
  const rpc=path.endsWith('/companion_activity')?'companion_activity':'companion_command';
  query = `select public.${rpc}(${literal(data.p_action)},${literal(JSON.stringify(data.p_payload))}::jsonb);`;
  } else query = homeFixtureSql(request.method, url, data);
  const sql = `begin; set local role authenticated; set local "request.jwt.claim.sub"=${literal(session.user.id)}; set local standard_conforming_strings=on; ${query} commit;`;
  const { stdout } = await exec('psql',['-qAt','-v','ON_ERROR_STOP=1','-d','life_ascension_auth_test','-c',sql],{ timeout:10000,maxBuffer:1024*1024 });
  finish(200,JSON.parse(stdout.trim()));
 } catch(error) {
  const message=error.stderr?.match(/ERROR:\s+([^\n]+)/)?.[1] || 'Test request failed';
  finish(400,{code:'P0001',message,details:null,hint:null});
 }
});
server.listen(54329,'127.0.0.1',()=>console.log('Companion fixture gateway: local synthetic auth → actual PostgreSQL/RLS'));

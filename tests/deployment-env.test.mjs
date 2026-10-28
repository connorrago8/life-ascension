import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateDeploymentEnv } from '../scripts/verify-deployment-env.mjs';

const jwt = (ref, role='anon') => [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
  Buffer.from(JSON.stringify({iss:'supabase',ref,role})).toString('base64url'),
  'test-only-invalid-signature',
].join('.');
const qaRef='njqwwimzrsunheehnnnt', prodRef='ugcvhmrriazbbymjxvch';
const qa={VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:`https://${qaRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt(qaRef)};
const production={...qa,VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:`https://${prodRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt(prodRef)};

test('accepts correctly paired QA preview/development and Production fixtures',()=>{
  assert.equal(validateDeploymentEnv(qa),true);
  assert.equal(validateDeploymentEnv({...qa,VERCEL_ENV:'development'}),true);
  assert.equal(validateDeploymentEnv(production),true);
});
test('rejects both wrong URL target and mismatched public key in either direction',()=>{
  for(const env of [
    {...qa,NEXT_PUBLIC_SUPABASE_URL:production.NEXT_PUBLIC_SUPABASE_URL},
    {...production,NEXT_PUBLIC_SUPABASE_URL:qa.NEXT_PUBLIC_SUPABASE_URL},
    {...qa,NEXT_PUBLIC_SUPABASE_ANON_KEY:production.NEXT_PUBLIC_SUPABASE_ANON_KEY},
    {...production,NEXT_PUBLIC_SUPABASE_ANON_KEY:qa.NEXT_PUBLIC_SUPABASE_ANON_KEY},
  ]) assert.throws(()=>validateDeploymentEnv(env),/Blocked/);
});
test('rejects absent env, public service role, unknown keys and privileged Preview',()=>{
  for(const env of [
    {...qa,VERCEL_ENV:undefined}, {...qa,NEXT_PUBLIC_SUPABASE_ANON_KEY:''},
    {...qa,NEXT_PUBLIC_SUPABASE_ANON_KEY:'placeholder'},
    {...qa,NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt(qaRef,'service_role')},
    {...qa,SUPABASE_SERVICE_ROLE_KEY:'placeholder'},
  ]) assert.throws(()=>validateDeploymentEnv(env));
});
test('rejects spoofed URL, HTTP, URL credentials and query parameters',()=>{
  for(const url of [`https://${qaRef}.supabase.co.evil.example`,`http://${qaRef}.supabase.co`,
    `https://user:pass@${qaRef}.supabase.co`,`https://${qaRef}.supabase.co/?override=1`])
    assert.throws(()=>validateDeploymentEnv({...qa,NEXT_PUBLIC_SUPABASE_URL:url}),/Blocked preview/);
});
test('opaque publishable key requires approved fingerprint and rejects wrong pin',()=>{
  const key='sb_publishable_test-only-not-a-real-key';
  const good={...qa,NEXT_PUBLIC_SUPABASE_ANON_KEY:key,
    SUPABASE_PUBLIC_KEY_SHA256:createHash('sha256').update(key).digest('hex')};
  assert.throws(()=>validateDeploymentEnv({...qa,NEXT_PUBLIC_SUPABASE_ANON_KEY:key}),/pairing/);
  assert.equal(validateDeploymentEnv(good),true);
  assert.throws(()=>validateDeploymentEnv({...good,SUPABASE_PUBLIC_KEY_SHA256:'0'.repeat(64)}),/pairing/);
});
test('legacy anon JWT optionally supports a fingerprint pin',()=>{
  const pin=createHash('sha256').update(qa.NEXT_PUBLIC_SUPABASE_ANON_KEY).digest('hex');
  assert.equal(validateDeploymentEnv({...qa,SUPABASE_PUBLIC_KEY_SHA256:pin}),true);
  assert.throws(()=>validateDeploymentEnv({...qa,SUPABASE_PUBLIC_KEY_SHA256:'f'.repeat(64)}),/pairing/);
});

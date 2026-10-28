import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeploymentEnv } from '../scripts/verify-deployment-env.mjs';

const qa = {VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://njqwwimzrsunheehnnnt.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'placeholder-public-key'};
const prod = {VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://ugcvhmrriazbbymjxvch.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'placeholder-public-key'};

test('accepts isolated QA Preview',()=>assert.equal(validateDeploymentEnv(qa),true));
test('accepts correct Production',()=>assert.equal(validateDeploymentEnv(prod),true));
test('rejects Preview pointing to Production',()=>assert.throws(()=>validateDeploymentEnv({...qa,NEXT_PUBLIC_SUPABASE_URL:prod.NEXT_PUBLIC_SUPABASE_URL}),/Blocked preview/));
test('rejects Production pointing to QA',()=>assert.throws(()=>validateDeploymentEnv({...prod,NEXT_PUBLIC_SUPABASE_URL:qa.NEXT_PUBLIC_SUPABASE_URL}),/Blocked production/));
test('rejects missing target or public credentials',()=>{
 assert.throws(()=>validateDeploymentEnv({...qa,VERCEL_ENV:undefined}),/VERCEL_ENV/);
 assert.throws(()=>validateDeploymentEnv({...qa,NEXT_PUBLIC_SUPABASE_ANON_KEY:''}),/required/);
});
test('rejects privileged service key in Preview',()=>assert.throws(()=>validateDeploymentEnv({...qa,SUPABASE_SERVICE_ROLE_KEY:'placeholder'}),/privileged/));
test('rejects spoofed Supabase host',()=>assert.throws(()=>validateDeploymentEnv({...qa,NEXT_PUBLIC_SUPABASE_URL:'https://njqwwimzrsunheehnnnt.supabase.co.evil.example'}),/Blocked preview/));

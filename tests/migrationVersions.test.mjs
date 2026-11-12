import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
test('the integrated migration chain has unique version identifiers',()=>{
 const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql'));
 const versions=new Set();
 for(const file of files){const version=file.split('_')[0]; assert.equal(versions.has(version),false,`duplicate migration version: ${version}`); versions.add(version);}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const core={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/navigationMode.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:core,URL,URLSearchParams});
const href=core.navigationModeHref;
test('development preview survives Hub,Town,Character and quest destinations',()=>{
 for(const path of ['/','/play','/play/emberhaven','/play/emberhaven/blacksmith','/play/delve','/character','/quests'])assert.equal(href(path,'?preview=1',true),path+'?preview=1');
});
test('normal and production paths remain unchanged',()=>{
 for(const search of ['','?preview=0','?preview=true','?other=1'])assert.equal(href('/play',search,true),'/play');
 assert.equal(href('/play','?preview=1',false),'/play');
});
test('destination query and fragment are retained without forwarding unrelated source parameters',()=>{
 assert.equal(href('/play?view=map#crypt','?preview=1&token=do-not-forward',true),'/play?view=map&preview=1#crypt');
});
test('explicit destination mode wins and repeated resolution does not duplicate it',()=>{
 assert.equal(href('/play?preview=0','?preview=1',true),'/play?preview=0');
 assert.equal(href('/play?preview=1','?preview=1',true),'/play?preview=1');
});
test('external,protocol-relative and same-page targets are not rewritten',()=>{
 for(const path of ['https://example.com/play','//example.com/play','#story','?view=map'])assert.equal(href(path,'?preview=1',true),path);
});

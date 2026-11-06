import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/ui/focus-visibility.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports',compiled)(mod,mod.exports);
const {focusScrollDelta}=mod.exports;

test('visible controls retain the current reading position',()=>{
 assert.equal(focusScrollDelta({top:100,bottom:148},{top:0,bottom:844},783),0);
});
test('the reproduced reward field moves above fixed navigation',()=>{
 const rect={top:810,bottom:906};
 const delta=focusScrollDelta(rect,{top:0,bottom:844},783);
 assert.equal(delta,466.5);
 assert.ok(rect.top-delta>=16&&rect.bottom-delta<=767);
});
test('a control clipped above the viewport is brought back into view',()=>{
 const rect={top:-20,bottom:28},delta=focusScrollDelta(rect,{top:0,bottom:844});
 assert.ok(delta<0&&rect.top-delta>=16&&rect.bottom-delta<=828);
});
test('visual viewport offsets and keyboard shrinkage constrain the scroll',()=>{
 const rect={top:280,bottom:376},view={top:100,bottom:300};
 const delta=focusScrollDelta(rect,view,783);
 assert.equal(delta,128);
 assert.ok(rect.top-delta>=116&&rect.bottom-delta<=284);
});
test('no usable viewport avoids an invalid scroll during viewport transitions',()=>{
 assert.equal(focusScrollDelta({top:100,bottom:148},{top:100,bottom:120}),0);
});

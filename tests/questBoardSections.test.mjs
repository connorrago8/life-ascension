/** Issue #46: Today / This Week / Upcoming board sections and one-tap completion.
 * Source-contract and render checks only; no hosted database or browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';

const home=readFileSync(new URL('../app/(app)/page.tsx',import.meta.url),'utf8');
const controls=readFileSync(new URL('../components/QuestProgressControls.tsx',import.meta.url),'utf8');
const journal=readFileSync(new URL('../app/(app)/quests/page.tsx',import.meta.url),'utf8');

test('board renders Today, This Week and Upcoming sections',()=>{
 for(const label of ['Today','This Week','Upcoming'])assert.match(home,new RegExp(`aria-label="${label}"><h3>${label} `));
});

test('future one-time instances are loaded so weekly and future quests are visible',()=>{
 assert.match(home,/\.in\('quest_id',onceIds\)\.neq\('status','completed'\)/);
 assert.doesNotMatch(home,/\.in\('quest_id',onceIds\)\.lte\(/);
});

test('All caught up appears only when no section has open quests',()=>{
 assert.match(home,/const openCount=activeQuests\.length\+notStarted\.length/);
 assert.match(home,/\{openCount===0&&completed>0&&<p className="muted">All caught up!/);
});

test('completion uses the in-app confirm and the existing receipt RPC only',()=>{
 assert.doesNotMatch(home,/window\.confirm/);
 assert.match(home,/<ConfirmCompleteButton label="Complete" questTitle=\{quest\.title\} disabled=\{busy\} onConfirm=\{\(\)=>act\(instance!\.id,'complete'\)\}\/>/);
 assert.match(home,/\.rpc\('set_quest_instance_status_v2',\{p_instance_id:id,p_action:action\}\)/);
 assert.match(home,/if\(busy\|\|questActionInFlight\.current\)return;/);
});

test('tracked quests get a Complete button that logs the remaining amount via the journaled RPC',()=>{
 assert.match(controls,/const completeDelta = remaining > 0 \? remaining : null;/);
 assert.match(controls,/<ConfirmCompleteButton label="Complete" questTitle=\{quest\.title\} disabled=\{disabled \|\| saving \|\| retrying \|\| storageError\} onConfirm=\{\(\) => submit\(completeDelta\)\} \/>/);
 // submit() keeps the single-flight lock and pending-journal guard.
 assert.match(controls,/if \(instance\.status !== 'available' \|\| disabled \|\| saving \|\| operationInFlight\.current \|\| storageError \|\| retrying/);
});

test('journal shows today\u2019s completion instead of listing a done quest as active',()=>{
 assert.match(journal,/Done today/);
 assert.match(journal,/\.from\('quest_instances'\)\.select\('quest_id,due_date,status'\)\.eq\('owner_id', user\.id\)/);
});

function loadButton(){
 const url=new URL('../components/ConfirmCompleteButton.tsx',import.meta.url);
 const out=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const m={exports:{}};new Function('require','module','exports',out.outputText)(createRequire(url),m,m.exports);return m.exports.ConfirmCompleteButton;
}
test('confirm button starts unarmed with an accessible label',()=>{
 const html=renderToStaticMarkup(createElement(loadButton(),{label:'Complete',questTitle:'Brush teeth',disabled:false,onConfirm(){}}));
 assert.match(html,/aria-label="Complete Brush teeth"/);
 assert.match(html,/>Complete<\/button>/);
});

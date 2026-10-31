import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const source = readFileSync(new URL("../src/lib/quest-board-v3.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
const require = createRequire(import.meta.url);
new Function("exports", "require", js)(exports, require);
const {questDay, questWeek, completeQuest, individualStreak, selectDailyQuests, bonusChoices, rerollBonus, isWeeklyRevealed, getOrCreateDailySelection, rewardPreview} = exports;
const at = s => new Date(s);
const quest = (id, cadence="daily") => ({id,title:id,cadence,source:"manual",enabled:true,priority:5,createdAt:"2026-10-31T00:00:00Z"});
const empty = quests => ({quests,completions:[],pendingInputs:[],weeklyReviews:[],goals:[],rewards:[],bonusRerolls:{}});
test("Chicago 05:00 reset respects DST",()=>{
 assert.equal(questDay(at("2026-11-01T10:59:59Z")),"2026-10-31");
 assert.equal(questDay(at("2026-11-01T11:00:00Z")),"2026-11-01");
 assert.equal(questDay(at("2026-03-08T09:59:59Z")),"2026-03-07");
 assert.equal(questDay(at("2026-03-08T10:00:00Z")),"2026-03-08");
});
test("weekly period starts Monday",()=>{
 assert.equal(questWeek(at("2026-10-31T18:00:00Z")),"2026-10-26");
 assert.equal(questWeek(at("2026-11-02T18:00:00Z")),"2026-11-02");
});
test("off-board completion awards XP once per period",()=>{
 const q=quest("floss");const s=empty([q]);const now=at("2026-10-31T17:00:00Z");
 const first=completeQuest(s,"floss",now,"chat");
 assert.equal(first.xpAwarded,1);
 assert.equal(completeQuest(first.state,"floss",now,"tap").xpAwarded,0);
 assert.equal(first.state.completions[0].source,"chat");
});
test("individual daily streak includes yesterday when today unfinished",()=>{
 const q=quest("brush"),now=at("2026-10-31T17:00:00Z");
 const c=["2026-10-29","2026-10-30"].map(period=>({questId:"brush",period,completedAt:period+"T18:00:00Z",source:"tap"}));
 assert.equal(individualStreak(q,c,now),2);
 assert.equal(individualStreak(q,c,at("2026-11-02T17:00:00Z")),0);
});
test("daily selection deterministic and frozen once saved",()=>{
 const qs=Array.from({length:25},(_,i)=>quest(String(i)));
 const now=at("2026-10-31T17:00:00Z");
 assert.equal(selectDailyQuests(qs,now).length,10);
 const saved=getOrCreateDailySelection(qs,now);
 assert.deepEqual(getOrCreateDailySelection([],now,saved),saved);
});
test("bonus choices gated; reroll once",()=>{
 const qs=Array.from({length:12},(_,i)=>quest(String(i))),now=at("2026-10-31T17:00:00Z");
 let state=empty(qs);
 assert.equal(bonusChoices(state,now).length,0);
 for(const q of selectDailyQuests(qs,now))state=completeQuest(state,q.id,now,"tap").state;
 assert.equal(bonusChoices(state,now).length,3);
 state=rerollBonus(state,now);
 assert.throws(()=>rerollBonus(state,now),/already used/);
});
test("weekly reveal complete by Wednesday 14:00",()=>{
 const qs=Array.from({length:30},(_,i)=>quest(String(i),"weekly"));
 const now=at("2026-10-28T19:00:00Z");
 assert.ok(qs.every(q=>isWeeklyRevealed(q,now)));
});
test("reward stats hidden until requested",()=>{
 const reward={id:"r",title:"Armor",requirement:"Goal",estimatedLabel:"Rare equipment",previewStats:{defense:5}};
 assert.equal(rewardPreview(reward,false).stats,undefined);
 assert.deepEqual(rewardPreview(reward,true).stats,{defense:5});
});

test("weekly review remains attributed to original week",()=>{
 const s=empty([quest("clean","weekly")]);
 const result=exports.resolveWeeklyReview(s,"clean","2026-10-26","pending");
 assert.deepEqual(result.weeklyReviews,[{questId:"clean",week:"2026-10-26",status:"pending"}]);
 const revised=exports.resolveWeeklyReview(result,"clean","2026-10-26","completed");
 assert.equal(revised.weeklyReviews.length,1);
 assert.equal(revised.weeklyReviews[0].status,"completed");
 assert.throws(()=>exports.resolveWeeklyReview(s,"clean","2026-10-27","completed"),/Monday/);
});
test("pending suggestions resolve only once",()=>{
 const s={...empty([]),pendingInputs:[{id:"one",question:"Add reminder?",createdAt:"2026-10-31T12:00:00Z"}]};
 const first=exports.resolvePendingInput(s,"one",at("2026-10-31T18:00:00Z"));
 const second=exports.resolvePendingInput(first,"one",at("2026-11-01T18:00:00Z"));
 assert.deepEqual(first,second);
});
test("AI suggestions reject duplicate titles regardless of whitespace and case",()=>{
 assert.equal(exports.isDuplicateQuestTitle([quest("Brush Teeth")]," brush   teeth "),true);
 assert.equal(exports.isDuplicateQuestTitle([quest("Brush Teeth")],"Fold laundry"),false);
});

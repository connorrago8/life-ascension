import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/quests/companion-credit.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", "require", compiled)(module, module.exports, () => { throw new Error("Unexpected import"); });
const { awardCredits, chicagoDate, weekStart, weeklyCompanionXp } = module.exports;

const entry = (id, actor, source, localDate = "2026-11-05") => ({ id, actor, source, localDate, questKey: "brush teeth", completed: true });

test("personal quest awards 1 XP once despite duplicate events", () => {
  assert.equal(awardCredits([entry("1", "connor", "personal"), entry("1", "connor", "personal")]).total.connor, 1);
});
test("Izzy submission overlap upgrades to 2 XP, never 3", () => {
  const records = [entry("1", "izzy", "personal"), entry("2", "izzy", "izzy-submission"), entry("3", "izzy", "izzy-submission")];
  assert.equal(awardCredits(records).total.izzy, 2);
});
test("credits are separate by actor and date", () => {
  const records = [entry("1", "connor", "personal"), entry("2", "izzy", "izzy-submission"), entry("3", "izzy", "personal", "2026-11-06")];
  assert.deepEqual({ ...awardCredits(records).total }, { connor: 1, izzy: 3 });
});
test("incomplete quest awards no XP", () => {
  assert.equal(awardCredits([{ ...entry("1", "izzy", "izzy-submission"), completed: false }]).total.izzy, 0);
});
test("Chicago date respects DST and midnight boundary", () => {
  assert.equal(chicagoDate(new Date("2026-11-01T04:30:00Z")), "2026-10-31");
  assert.equal(chicagoDate(new Date("2026-11-01T06:30:00Z")), "2026-11-01");
});
test("weekly XP starts Monday, excludes previous Sunday", () => {
  assert.equal(weekStart("2026-11-05"), "2026-11-02");
  assert.equal(weeklyCompanionXp([entry("1", "izzy", "personal", "2026-11-01"), entry("2", "izzy", "izzy-submission", "2026-11-02")], "2026-11-05"), 2);
});

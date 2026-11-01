import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile the pure staging module without a TS runtime dependency.
const source = readFileSync(new URL("../lib/izzy/tally-staging.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", js)(module, module.exports);
const { stageIzzySubmission } = module.exports;

const headers = [
  "Submission ID",
  "☀️ DAILY HABITS: What are some things Connor should do every day?",
  "🏠 WEEKLY CHORES: What should Connor do once or twice a week?",
  "🎁 REWARDS: What rewards would you like to offer Connor?",
  "Should your rewards be secret or visible?",
];

test("stages a verified-shape submission without splitting free text", () => {
  const result = stageIzzySubmission(headers, ["abc123", "Brush teeth\nMake bed", "", "Dinner date", "Secret until unlocked"]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((x) => x.category), ["daily", "reward"]);
  assert.equal(result[0].text, "Brush teeth\nMake bed");
  assert.equal(result[0].status, "review_required");
  assert.equal(result[1].visibility, "secret");
  assert.equal(result[0].sourceSubmissionId, "abc123");
});

test("skips empty answers and retains explicit visible rewards", () => {
  const result = stageIzzySubmission(headers, ["abc123", "  ", "Laundry", "Coffee", "Visible to Connor"]);
  assert.deepEqual(result.map((x) => x.category), ["weekly", "reward"]);
  assert.equal(result[1].visibility, "visible");
});

test("refuses missing or invalid submission identifiers", () => {
  assert.throws(() => stageIzzySubmission(headers, ["", "a"]), /Invalid submission ID/);
  assert.throws(() => stageIzzySubmission(["other"], ["a"]), /Missing Submission ID/);
});

test("does not guess secret/visible for per-reward instructions", () => {
  const result = stageIzzySubmission(headers, ["abc123", "", "", "Two rewards", "I'll specify individually"]);
  assert.equal(result[0].visibility, "unspecified");
});

test("rejects oversized text rather than silently truncating", () => {
  assert.throws(() => stageIzzySubmission(headers, ["abc123", "x".repeat(20001)]), /exceeds limit/);
});

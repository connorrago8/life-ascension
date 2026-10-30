import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { questDetailHref, shouldOpenQuestCard, QUEST_CARD_INTERACTIVE_SELECTOR } from '../lib/questCardTap.ts';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const home = read('app/(app)/page.tsx');
const journal = read('app/(app)/quests/page.tsx');
const fakeTarget = (insideControl) => ({ closest: (sel) => (sel === QUEST_CARD_INTERACTIVE_SELECTOR && insideControl ? {} : null) });

test('card taps open details but never hijack nested controls or text selection', () => {
  assert.equal(questDetailHref('abc-1'), '/quests/abc-1');
  assert.equal(shouldOpenQuestCard(fakeTarget(false)), true);
  assert.equal(shouldOpenQuestCard(fakeTarget(true)), false, 'Complete/Defer/inputs keep their own behavior');
  assert.equal(shouldOpenQuestCard(fakeTarget(false), 'selected words'), false);
  assert.equal(shouldOpenQuestCard(null), false);
  for (const control of ['a', 'button', 'input', 'summary', 'details', 'label']) {
    assert.ok(QUEST_CARD_INTERACTIVE_SELECTOR.split(', ').includes(control), control);
  }
});

test('Home completed quests collapse into one closed-by-default Completed (N) section', () => {
  assert.match(home, /const \[showCompleted,setShowCompleted\]=useState\(false\)/);
  assert.match(home, /className="board-section board-completed" aria-label="Completed"/);
  assert.match(home, /aria-expanded=\{showCompleted\} aria-controls="completed-quests-list"/);
  assert.match(home, / Completed \(\{completed\}\)<\/button>/);
  assert.equal((home.match(/Completed \(\{completed\}\)/g) ?? []).length, 1);
});

test('Home quest cards are tap-to-open with a keyboard-reachable title link to the detail route', () => {
  assert.match(home, /<Link className="quest-title-link" href=\{questDetailHref\(quest\.id\)\}/);
  assert.match(home, /if\(shouldOpenQuestCard\(e\.target as Element,selection\)\)router\.push\(questDetailHref\(quest\.id\)\)/);
  assert.match(home, /<ConfirmCompleteButton label="Complete" questTitle=\{quest\.title\} disabled=\{busy\} onConfirm=\{\(\)=>act\(instance!\.id,'complete'\)\}\/>/);
});

test('Create a quest reveals and focuses the creator instead of a dead tap', () => {
  assert.match(home, /aria-controls="quest-create-form"/);
  assert.match(home, /<form id="quest-create-form" ref=\{questFormRef\}/);
  assert.match(home, /form\.scrollIntoView\(/);
  assert.match(home, /querySelector<HTMLInputElement>\('#quest-title'\)\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(home, /id="quest-title"/);
});

test('Journal done quests show a static Done state instead of a View progress toggle', () => {
  assert.match(journal, /done && quest\.active \? <span className="tag" aria-label=\{`\$\{quest\.title\} done`\}>✓ Done<\/span>/);
  assert.match(journal, /<Link className="quest-title-link" href=\{questDetailHref\(quest\.id\)\}/);
});

test('Play hub banner clears the iPhone Dynamic Island without touching the Crypt run', () => {
  const css = read('app/style.css');
  assert.match(css, /\.screen\.play-screen \{ padding-top: calc\(12px \+ env\(safe-area-inset-top\)\); \}/);
  assert.doesNotMatch(css, /\.screen\.crypt-screen \{ padding-top: calc/);
});

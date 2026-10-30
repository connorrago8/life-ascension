/** Quest board "Done today" / "Completed" sections: collapsed by default, count in the header, accessible toggle. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function loadCollapsible() {
  const { outputText } = ts.transpileModule(read('components/CollapsibleSection.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(require, module, module.exports);
  return module.exports.CollapsibleSection;
}

test('CollapsibleSection renders closed by default with "Title (N)", a chevron and aria-expanded', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const CollapsibleSection = loadCollapsible();
  const closed = renderToStaticMarkup(React.createElement(CollapsibleSection, { title: 'Completed', count: 3 }, React.createElement('p', null, 'quest body')));
  assert.match(closed, /<button type="button" class="collapsible-toggle" aria-expanded="false" aria-controls="[^"]+">/);
  assert.match(closed, /Completed \(3\)/);
  assert.match(closed, /class="collapsible-chevron" aria-hidden="true">▸</);
  assert.match(closed, /hidden=""/);
  assert.doesNotMatch(closed, /quest body/, 'collapsed sections do not render their quests');
  const open = renderToStaticMarkup(React.createElement(CollapsibleSection, { title: 'Done today', count: 2, defaultOpen: true }, React.createElement('p', null, 'quest body')));
  assert.match(open, /aria-expanded="true"/);
  assert.match(open, /Done today \(2\)/);
  assert.match(open, /collapsible-chevron is-open/);
  assert.match(open, /quest body/);
});

test('Journal splits "Done today" and "Completed" into collapsible sections without touching quest actions', () => {
  const journal = read('app/(app)/quests/page.tsx');
  assert.match(journal, /<CollapsibleSection title="Done today" count=\{doneTodayQuests\.length\}/);
  assert.match(journal, /<CollapsibleSection title="Completed" count=\{completedQuests\.length\}/);
  assert.doesNotMatch(journal, /defaultOpen/, 'both start closed');
  assert.match(journal, /doneQuests\.filter\(\(quest\) => quest\.cadence === 'daily'\)/);
  assert.match(journal, /doneQuests\.filter\(\(quest\) => quest\.cadence !== 'daily'\)/);
});

test('Home board and Home preview keep Completed closed by default with a count and accessible toggle', () => {
  const home = read('app/(app)/page.tsx');
  assert.match(home, /const \[showCompleted,setShowCompleted\]=useState\(false\)/);
  assert.match(home, /aria-expanded=\{showCompleted\}/);
  assert.match(home, /Completed \(\{completed\}\)/);
  const preview = read('components/preview/HomeScreen.tsx');
  assert.match(preview, /const \[showCompleted, setShowCompleted\] = useState\(false\)/);
  assert.match(preview, /aria-expanded=\{showCompleted\}/);
  assert.match(preview, /Completed \(\{completedQuests\.length\}\)/);
  assert.match(preview, /collapsible-chevron/);
});

test('collapsible headers are 44px tap targets with a visible focus ring and reduced motion', () => {
  const css = read('app/style.css');
  assert.match(css, /\.collapsible-toggle \{[^}]*min-height: 44px/);
  assert.match(css, /\.collapsible-toggle:focus-visible/);
  assert.match(css, /prefers-reduced-motion[^{]*\{[^}]*\.collapsible-chevron/);
});

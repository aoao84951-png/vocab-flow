const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const compiled = ts.transpileModule(fs.readFileSync('lib/navigationHistory.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleUnderTest = { exports: {} };
new Function('exports', 'module', compiled)(moduleUnderTest.exports, moduleUnderTest);
const { NavigationHistory, mainScreen } = moduleUnderTest.exports;
function setup() {
  const history = { entries: [{ nextRouter: true }], index: 0, pending: [],
    get state() { return this.entries[this.index]; },
    replaceState(data) { this.entries[this.index] = data; },
    pushState(data) { this.entries.splice(++this.index); this.entries.push(data); },
    go(delta) { this.pending.push(delta); },
  };
  let screen;
  const nav = new NavigationHistory(history, next => { screen = next; nav.sync(next); });
  const flush = () => { while (history.pending.length) { history.index += history.pending.shift(); assert.ok(history.index >= 0 && history.index < history.entries.length); nav.pop(history.state); } };
  return { history, nav, flush, get screen() { return screen; }, back() { history.go(-1); flush(); }, forward() { history.go(1); flush(); } };
}
const study = index => mainScreen({ step: 'study', folderPath: ['toeic', 'start', 'voca'], selectedDayId: 'day1', wordIndex: index });
test('deep entry includes every parent; 100 words create only one study entry; forward restores last word', () => {
  const app = setup(); app.nav.sync(study(0));
  for (let i = 1; i < 100; i++) app.nav.sync(study(i));
  assert.equal(app.history.entries.length, 6);
  app.back(); assert.equal(app.screen.step, 'wordList');
  for (let depth = 3; depth > 0; depth--) { app.back(); assert.equal(app.screen.step, 'day'); assert.equal(app.screen.folderPath.length, depth); }
  app.back(); assert.equal(app.screen.step, 'book');
  for (let i = 0; i < 5; i++) app.forward();
  assert.equal(app.screen.wordIndex, 99);
  assert.equal(app.history.state.nextRouter, true);
});
test('return to list reuses existing entry and does not trap back between study and list', () => {
  const app = setup(); app.nav.sync(study(7));
  app.nav.sync(mainScreen({ ...study(7), step: 'wordList' })); app.flush();
  assert.equal(app.history.index, 4);
  app.back(); assert.equal(app.screen.folderPath.length, 3); assert.equal(app.screen.step, 'day');
});
test('moving to another day branches at the containing folder', () => {
  const app = setup(); app.nav.sync(study(7));
  app.nav.sync(mainScreen({ ...study(7), step: 'wordList', selectedDayId: 'day2' })); app.flush();
  assert.equal(app.history.entries.length, 5); assert.equal(app.screen.selectedDayId, 'day2');
  app.back(); assert.equal(app.screen.step, 'day');
});
test('remount or reload adopts existing history without adding entries', () => {
  const app = setup(); app.nav.sync(study(4));
  new NavigationHistory(app.history, () => {}).sync(app.history.state.screen);
  assert.equal(app.history.entries.length, 6); app.back(); assert.equal(app.screen.step, 'wordList');
});
test('legacy saved editor normalizes to a list instead of restoring an edit form', () => {
  assert.equal(mainScreen({ ...study(3), step: 'editWord' }).step, 'wordList');
});

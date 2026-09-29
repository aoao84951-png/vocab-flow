const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync('lib/dayLinks.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod.exports, mod);
const { groupDays, removeDayLinks, detachDay, supplementCandidates } = mod.exports;

test('group explicit links only, preserving Day identity and sibling order', () => {
  const days = [{ id: 'x', title: 'bonus', supplementTo: 'a' }, { id: 'b', title: 'bonus' }, { id: 'a' }, { id: 'y', supplementTo: 'a' }];
  assert.deepEqual(groupDays(days).map(g => [g.day.id, g.supplements.map(d => d.id)]), [['b', []], ['a', ['x', 'y']]]);
  assert.equal(groupDays(days)[1].supplements[0], days[0]);
  assert.deepEqual(supplementCandidates(days, 'x').map(d => d.id), ['b', 'a']);
  assert.deepEqual(supplementCandidates(days, 'a'), []);
});

test('missing parents, self links, cycles and legacy data never hide Days', () => {
  const days = [{ id: 'a', supplementTo: 'b' }, { id: 'b', supplementTo: 'a' }, { id: 'c', supplementTo: 'c' }, { id: 'd', supplementTo: 'gone' }, { id: 'e' }, { id: 'f', supplementTo: 'e' }, { id: 'g', supplementTo: 'f' }];
  const visible = groupDays(days).flatMap(g => [g.day.id, ...g.supplements.map(d => d.id)]);
  assert.deepEqual(visible.sort(), days.map(d => d.id).sort());
  assert.deepEqual(groupDays([]), []);
});

test('deleting or moving a parent detaches supplements without deleting their words', () => {
  const days = [{ id: 'a' }, { id: 'x', supplementTo: 'a', words: ['hello'] }, { id: 'b' }];
  assert.deepEqual(removeDayLinks(days, 'a'), [{ id: 'x', words: ['hello'] }, { id: 'b' }]);
  assert.deepEqual(detachDay(days[1]), { id: 'x', words: ['hello'] });
  assert.equal(days[1].supplementTo, 'a');
  assert.deepEqual(removeDayLinks(days, 'x'), [{ id: 'a' }, { id: 'b' }]);
});

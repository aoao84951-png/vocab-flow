const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync('lib/folderActions.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod.exports, mod);
const { applyFolderAction: apply, findFolderPath } = mod.exports;
const folder = (id, folders = []) => ({ id, title: id, folders, days: [{ id: `day-${id}`, words: [{ word: 'hello' }] }] });
const source = [folder('a', [folder('child', [folder('grandchild')])]), folder('b'), folder('c')];
test('reorder at root in either direction without changing original', () => {
  const next = apply(source, { kind: 'move', id: 'a', destination: '', relativeTo: 'b', placement: 'after' });
  assert.deepEqual(next.map(x => x.id), ['b', 'a', 'c']);
  assert.deepEqual(next[1], source[0]);
  assert.deepEqual(source.map(x => x.id), ['a', 'b', 'c']);
  assert.deepEqual(apply(next, { kind: 'move', id: 'c', destination: '', relativeTo: 'b', placement: 'before' }).map(x => x.id), ['c', 'b', 'a']);
});
test('move subtree between parents and back to root', () => {
  const next = apply(source, { kind: 'move', id: 'child', destination: 'b' });
  assert.equal(next[0].folders.length, 0);
  assert.deepEqual(next[1].folders[0], source[0].folders[0]);
  assert.deepEqual(findFolderPath(next, 'grandchild'), ['b', 'child', 'grandchild']);
  const root = apply(next, { kind: 'move', id: 'child', destination: '', relativeTo: 'a', placement: 'before' });
  assert.deepEqual(root.map(x => x.id), ['child', 'a', 'b', 'c']);
});
test('reject cycles and invalid destinations or anchors without losing data', () => {
  for (const action of [
    { id: 'a', destination: 'grandchild' }, { id: 'a', destination: 'a' },
    { id: 'a', destination: 'missing' }, { id: 'a', destination: '', relativeTo: 'child' },
    { id: 'a', destination: '', relativeTo: 'a' }
  ]) assert.equal(apply(source, { kind: 'move', ...action }), source);
});
test('insert among nested siblings', () => {
  const items = [folder('a', [folder('x'), folder('y')]), folder('b')];
  const next = apply(items, { kind: 'move', id: 'b', destination: 'a', relativeTo: 'y', placement: 'before' });
  assert.deepEqual(next[0].folders.map(x => x.id), ['x', 'b', 'y']);
  assert.equal(next.length, 1);
});

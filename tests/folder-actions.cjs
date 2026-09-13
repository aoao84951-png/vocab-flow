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
test('covers survive renaming and moves and can be explicitly removed', () => {
  const items = [{ ...folder('a'), coverImage: 'data:image/jpeg;base64,cover' }, folder('b')];
  const renamed = apply(items, { kind: 'edit', id: 'a', title: 'renamed', icon: '#', desc: '' });
  assert.equal(renamed[0].coverImage, items[0].coverImage);
  const moved = apply(renamed, { kind: 'move', id: 'a', destination: 'b' });
  assert.equal(moved[0].folders[0].coverImage, items[0].coverImage);
  assert.deepEqual(moved[0].folders[0].days, items[0].days);
  const removed = apply(moved, { kind: 'edit', id: 'a', title: 'renamed', icon: '#', desc: '', coverImage: '' });
  assert.equal(removed[0].folders[0].coverImage, '');
  assert.equal(items[0].coverImage, 'data:image/jpeg;base64,cover');
});
test('book identity survives edits and moves independently of cover changes', () => {
  const items = [{ ...folder('a'), isBook: true, coverImage: 'cover' }, folder('b')];
  const edit = { kind: 'edit', id: 'a', title: 'a', icon: '', desc: '' };
  const noCover = apply(items, { ...edit, coverImage: '' });
  assert.equal(noCover[0].isBook, true);
  assert.equal(apply(noCover, { kind: 'move', id: 'a', destination: 'b' })[0].folders[0].isBook, true);
  assert.equal(apply(noCover, { ...edit, isBook: false })[0].isBook, false);
  const added = apply(items, { kind: 'add', id: 'b', title: 'no cover', icon: '', desc: '', isBook: true, coverImage: '' });
  assert.equal(added[1].folders[0].isBook, true);
});
test('create a root book and add a Day at the specified nested folder', () => {
  const root = apply(source, { kind: 'add', id: '', title: 'new book', icon: '', desc: '', isBook: true });
  assert.equal(root.length, source.length + 1);
  assert.equal(root.at(-1).title, 'new book');
  assert.equal(root.at(-1).isBook, true);
  const nested = apply(root, { kind: 'add-day', id: 'grandchild', title: 'Day 02' });
  const days = nested[0].folders[0].folders[0].days;
  assert.equal(days.length, 2);
  assert.equal(days[1].title, 'Day 02');
  assert.deepEqual(days[1].words, []);
  assert.equal(source[0].folders[0].folders[0].days.length, 1);
  assert.equal(apply(root, { kind: 'add-day', id: 'missing', title: 'Day' }), root);
});
test('Day rename and reorder preserve words and unrelated folders', () => {
  const one = { id: 'd1', title: 'Day 1', words: [{ id: 'word', word: 'hello' }] };
  const two = { id: 'd2', title: 'Day 2', words: [] };
  const items = [{ ...folder('parent', [folder('child')]), days: [one, two] }];
  const renamed = apply(items, { kind: 'edit-day', id: 'parent', dayId: 'd1', title: 'Renamed' });
  assert.equal(renamed[0].days[0].title, 'Renamed');
  assert.deepEqual(renamed[0].days[0].words, one.words);
  const moved = apply(renamed, { kind: 'move-day', id: 'parent', dayId: 'd1', relativeTo: 'd2', placement: 'after' });
  assert.deepEqual(moved[0].days.map(d => d.id), ['d2', 'd1']);
  assert.deepEqual(moved[0].days[1].words, one.words);
  assert.deepEqual(moved[0].folders, items[0].folders);
  assert.equal(items[0].days[0].title, 'Day 1');
  assert.equal(apply(items, { kind: 'move-day', id: 'parent', dayId: 'd1', relativeTo: 'missing', placement: 'after' }), items);
});

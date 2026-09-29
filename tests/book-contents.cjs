const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync('lib/bookContents.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod.exports, mod);
const { resolveContentsPath, toggleContentsChapter } = mod.exports;
const node = (id, folders = []) => ({ id, title: id, folders, days: [] });
const books = [node('book', [node('lc', [node('part')]), node('rc')]), node('other')];
test('opening siblings closes the prior sibling but leaves other levels open', () => {
  const initial = { book: 'lc', lc: 'part' };
  assert.deepEqual(toggleContentsChapter(initial, 'book', 'rc'), { book: 'rc', lc: 'part' });
  assert.deepEqual(toggleContentsChapter(initial, 'book', 'lc'), { book: '', lc: 'part' });
  assert.deepEqual(initial, { book: 'lc', lc: 'part' });
});
test('deleting or moving the viewed chapter resolves to an existing contents page', () => {
  assert.deepEqual(resolveContentsPath(books, ['book', 'lc', 'part']).map(x => x.id), ['book', 'lc', 'part']);
  const moved = [node('book'), node('other', [node('lc', [node('part')])])];
  assert.deepEqual(resolveContentsPath(moved, ['book', 'lc', 'part']).map(x => x.id), ['other', 'lc', 'part']);
  assert.deepEqual(resolveContentsPath(books, ['book', 'lc', 'deleted']).map(x => x.id), ['book', 'lc']);
  assert.deepEqual(resolveContentsPath(books, ['deleted']), []);
  assert.deepEqual(resolveContentsPath(books, []), []);
});
test('reopening a Day stays at its containing book and reveals the full branch', () => {
  const { getContentsEntry } = mod.exports;
  const library = [node('category', [{ ...node('book', [node('lc', [node('part', [node('deep')])])]), coverImage: 'cover' }])];
  assert.deepEqual(getContentsEntry(library, ['category', 'book', 'lc', 'part', 'deep']), {
    path: ['category', 'book'], open: { book: 'lc', lc: 'part', part: 'deep' }
  });
  assert.deepEqual(getContentsEntry(books, ['book', 'lc', 'part']), { path: ['book'], open: { book: 'lc', lc: 'part' } });
});
test('a book without a cover opens its own page and legacy covers remain books', () => {
  const { getContentsEntry, isBookFolder } = mod.exports;
  const book = { ...node('book', [node('lc')]), isBook: true, coverImage: '' };
  assert.deepEqual(getContentsEntry([node('category', [book])], ['category', 'book', 'lc']), { path: ['category', 'book'], open: { book: 'lc' } });
  assert.equal(isBookFolder(book), true);
  assert.equal(isBookFolder({ coverImage: 'legacy' }), true);
  assert.equal(isBookFolder({ isBook: false, coverImage: 'legacy' }), false);
  assert.equal(isBookFolder(node('chapter')), false);
});

test('focused contents defaults to the first branch, switches siblings and resolves stale selections', () => {
  const { getFocusedContents } = mod.exports;
  const book = node('book', [node('lc', [node('part1'), node('part2')]), node('rc')]);
  assert.equal(getFocusedContents(book, {}).current.id, 'part1');
  assert.equal(getFocusedContents(book, { book: 'lc', lc: 'part2' }).current.id, 'part2');
  assert.equal(getFocusedContents(book, { book: 'rc', lc: 'part2' }).current.id, 'rc');
  assert.equal(getFocusedContents(book, { book: 'lc', lc: 'deleted' }).current.id, 'part1');
});

test('direct Days on intermediate folders and arbitrarily deep branches stay reachable', () => {
  const { getFocusedContents } = mod.exports;
  const book = { ...node('book', [node('lc', [node('part', [node('deep')])])]), days: [{ id: 'direct' }] };
  assert.equal(getFocusedContents(book, {}).current.id, 'book');
  const nested = getFocusedContents(book, { book: 'lc' });
  assert.deepEqual(nested.folders.map(f => f.id), ['book', 'lc', 'part', 'deep']);
  assert.equal(getFocusedContents(book, { book: 'book' }).current.id, 'book');
});

test('reopening a direct Day overrides a remembered deeper branch', () => {
  const { getContentsEntry, getFocusedContents } = mod.exports;
  const book = { ...node('book', [node('part')]), isBook: true, days: [{ id: 'direct', title: 'Direct Day', words: [] }] };
  const entry = getContentsEntry([book], ['book'], 'direct');
  assert.equal(getFocusedContents(book, { book: 'part', ...entry.open }).current.id, 'book');
});

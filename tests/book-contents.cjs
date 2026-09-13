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

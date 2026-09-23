const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

test('navigation stops current audio and rejects late responses from the previous word', async () => {
  const audios = [];
  let revoked = 0;
  const context = vm.createContext({
    AbortController,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => revoked++ },
    Audio: class {
      currentTime = 5;
      paused = false;
      constructor() { audios.push(this); }
      async play() {}
      pause() { this.paused = true; this.onpause?.(); }
    },
  });
  const code = stripTypeScriptTypes(fs.readFileSync('lib/pronunciationPlayback.ts', 'utf8')).replaceAll('export ', '');
  vm.runInContext(code, context);
  const { getPronunciationSignal, stopPronunciation, playPronunciationBlob } = context;
  const previous = getPronunciationSignal();
  await playPronunciationBlob({}, previous);
  stopPronunciation();
  assert.equal(audios[0].paused, true);
  assert.equal(audios[0].currentTime, 0);
  assert.equal(revoked, 1);
  await assert.rejects(playPronunciationBlob({}, previous), { name: 'AbortError' });
  assert.equal(audios.length, 1, 'late response must not create another audio');
  const current = getPronunciationSignal();
  assert.equal(current.aborted, false);
  await playPronunciationBlob({}, current);
  assert.equal(audios.length, 2);
  assert.equal(audios[1].paused, false);
  stopPronunciation();
  assert.equal(audios[1].paused, true);
  assert.equal(revoked, 2);
});

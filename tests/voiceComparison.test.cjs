const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const load = (path, globals) => {
  const code = stripTypeScriptTypes(fs.readFileSync(path, 'utf8'))
    .replace(/^import .*;\n/gm, '').replaceAll('export ', '');
  const context = vm.createContext({ Request, Response, Buffer, AbortSignal, process: { env: {} }, console, ...globals });
  vm.runInContext(code, context);
  return context;
};
const request = body => new Request('http://localhost/api/voice-comparison', { method: 'POST', body: JSON.stringify(body) });

test('comparison fixes rate at 1.0, validates candidates, and reports unavailable Azure', async () => {
  const config = load('lib/voiceComparison.ts', {});
  const voices = vm.runInContext('COMPARISON_VOICES', config);
  const calls = [];
  const route = load('app/api/voice-comparison/route.ts', {
    COMPARISON_VOICES: voices, NextResponse: Response,
    googleTts: async req => { calls.push(await req.json()); return new Response('audio'); },
  });
  assert.equal((await route.GET()).status, 200);
  assert.equal((await (await route.GET()).json()).azureReady, false);
  assert.equal((await route.POST(request({ id: 'uk-neural2', text: 'Hello, everyone.', speakingRate: 9 }))).status, 200);
  assert.equal(calls[0].voice, 'en-GB-Neural2-A');
  assert.equal(calls[0].speakingRate, 1);
  assert.equal((await route.POST(request({ id: 'uk-azure', text: 'Hello.' }))).status, 503);
  for (const body of [null, {}, { id: 'unknown', text: 'Hello' }, { id: 'us-wavenet', text: ' ' }, { id: 'us-wavenet', text: 'x'.repeat(601) }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  assert.equal(calls.length, 1);
});

test('normal TTS retains its original rate and rejects invalid rate values', async () => {
  const calls = [];
  const route = load('app/api/tts/route.ts', {
    NextResponse: Response, buildTtsInput: text => ({ text }),
    textToSpeech: { TextToSpeechClient: class { async synthesizeSpeech(body) { calls.push(body); return [{ audioContent: new Uint8Array([1]) }]; } } },
  });
  assert.equal((await route.POST(request({ text: 'Hello', voice: 'en-US-Wavenet-D' }))).status, 200);
  assert.equal(calls[0].audioConfig.speakingRate, 0.92);
  assert.equal((await route.POST(request({ text: 'Hello', voice: 'en-US-Wavenet-D', speakingRate: 1 }))).status, 200);
  assert.equal(calls[1].audioConfig.speakingRate, 1);
  for (const speakingRate of [null, '1', 0, 5]) assert.equal((await route.POST(request({ text: 'Hello', voice: 'en-US-Wavenet-D', speakingRate }))).status, 400);
  assert.equal(calls.length, 2);
});

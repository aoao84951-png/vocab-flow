const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { createHash } = require('node:crypto');
function load(file, globals = {}) {
  const code = stripTypeScriptTypes(fs.readFileSync(file, 'utf8')).replace(/^import .*;\n/gm, '').replaceAll('export ', '');
  const ctx = vm.createContext({ Buffer, Response, Request, AbortSignal, console, ...globals });
  vm.runInContext(code, ctx); return ctx;
}
const config = load('lib/azureVoices.ts');
const voices = vm.runInContext('AZURE_VOICES', config);
function server({ cached = null, cacheError = null, reserved = true, ledgerError = null, status = 200 } = {}) {
  const calls = { network: 0, reserve: 0, save: 0 };
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cached, error: cacheError }) }) }), upsert: async () => { calls.save++; return {}; } }),
    rpc: async (_, { p_characters }) => { calls.reserve++; calls.characters = p_characters; return { data: reserved, error: ledgerError }; },
  };
  const ctx = load('lib/azureTtsServer.ts', {
    createClient: () => db, createHash, AZURE_MONTHLY_LIMIT: 500000,
    azureSpeech: config.azureSpeech, reservedCharacters: config.reservedCharacters,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test', AZURE_SPEECH_KEY: 'test', AZURE_SPEECH_REGION: 'eastus', AZURE_SPEECH_TIER: 'F0' } },
    fetch: async () => { calls.network++; return new Response('audio', { status }); },
  });
  return { ctx, calls };
}
test('all six chosen voices escape SSML and preserve native punctuation', () => {
  assert.equal(voices.length, 6);
  for (const voice of voices) {
    const ssml = config.azureSpeech('Hello, <world> & everyone.', voice.id);
    assert.match(ssml, /Hello, &lt;world&gt; &amp; everyone/);
    assert.ok(!ssml.includes('<break'));
    assert.ok(config.reservedCharacters(ssml) >= ssml.length);
  }
  assert.throws(() => config.azureSpeech('test', 'injected'));
});
test('cached audio consumes no additional budget or Azure network calls', async () => {
  const { ctx, calls } = server({ cached: { audio_base64: Buffer.from('cached').toString('base64') } });
  assert.equal((await ctx.synthesizeAzure('hello', voices[0].id)).toString(), 'cached');
  assert.equal(calls.reserve, 0); assert.equal(calls.network, 0);
});
test('limit and ledger errors fail closed before Azure synthesis', async () => {
  for (const options of [{ reserved: false }, { ledgerError: {} }, { cacheError: {} }]) {
    const { ctx, calls } = server(options);
    await assert.rejects(ctx.synthesizeAzure('hello', voices[0].id));
    assert.equal(calls.network, 0);
  }
});
test('reserve before synthesize, cache success, do not refund uncertain failures', async () => {
  for (const status of [200, 429, 500]) {
    const { ctx, calls } = server({ status });
    if (status === 200) assert.equal((await ctx.synthesizeAzure('hello', voices[0].id)).toString(), 'audio');
    else await assert.rejects(ctx.synthesizeAzure('hello', voices[0].id));
    assert.equal(calls.reserve, 1); assert.equal(calls.network, 1);
    assert.equal(calls.save, status === 200 ? 1 : 0);
  }
});
test('paid tier or missing configuration cannot call Azure', async () => {
  const { ctx, calls } = server();
  ctx.process.env.AZURE_SPEECH_TIER = 'S0';
  await assert.rejects(ctx.synthesizeAzure('hello', voices[0].id));
  assert.equal(calls.reserve, 0); assert.equal(calls.network, 0);
});
test('client falls back without caching Google under an Azure identity; notices once', async () => {
  let requests = 0, alerts = 0;
  const ctx = load('lib/hybridTtsClient.ts', {
    AZURE_VOICES: voices, Event, localStorage: { getItem: key => key === 'vocab-flow-hybrid-tts' ? 'azure' : null },
    window: { alert: () => alerts++, dispatchEvent: () => {} },
    fetch: async () => { requests++; return Response.json({ fallback: 'limit' }, { status: 409 }); },
  });
  assert.equal(await ctx.loadHybridAudio('hello', 'en-US-Wavenet-D'), null);
  assert.equal(await ctx.loadHybridAudio('hello', 'en-US-Wavenet-D'), null);
  assert.equal(alerts, 1); assert.equal(requests, 2);
  assert.equal(await ctx.loadHybridAudio('한글', 'ko-KR-Wavenet-A'), null);
  assert.equal(requests, 2);
});

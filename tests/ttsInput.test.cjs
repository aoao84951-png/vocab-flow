const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const context = vm.createContext({});
vm.runInContext(stripTypeScriptTypes(fs.readFileSync('lib/ttsInput.ts', 'utf8')).replace('export const buildTtsInput', 'globalThis.buildTtsInput'), context);
const build = context.buildTtsInput;

test('English comma pauses are brief, while numeric commas and periods stay intact', () => {
  const sentence = "But I probably won't finish before we open our doors at 10, if that's alright.";
  for (const voice of ['en-US-Neural2-F', 'en-GB-Neural2-A', 'en-AU-Neural2-A']) {
    assert.equal(build(sentence, voice).ssml, `<speak>But I probably won't finish before we open our doors at 10<break time="100ms"/> if that's alright.</speak>`);
  }
  assert.equal(build('It costs 1,000,000 dollars, including tax.', 'en-US-Neural2-F').ssml, '<speak>It costs 1,000,000 dollars<break time="100ms"/> including tax.</speak>');
  assert.equal(build('1,000', 'en-US-Neural2-F').text, '1,000');
  assert.equal(build('Hello. How are you?', 'en-US-Neural2-F').text, 'Hello. How are you?');
  assert.equal(build('괜찮다면, 그래도 된다면', 'ko-KR-Wavenet-A').text, '괜찮다면, 그래도 된다면');
});

test('parenthetical double readings and SSML escaping are preserved', () => {
  const input = build('Yes, (please) come in.', 'en-US-Neural2-F').ssml;
  assert.equal(input, '<speak><s>Yes<break time="100ms"/> come in.</s><break time="500ms"/><s>Yes<break time="100ms"/> please come in.</s></speak>');
  const escaped = build('A & B, <break time="9s"/>.', 'en-US-Neural2-F').ssml;
  assert(escaped.includes('A &amp; B<break time="100ms"/> &lt;break time=&quot;9s&quot;/&gt;.'));
});

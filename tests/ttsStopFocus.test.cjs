const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');

// Exercise the production capture and study-key handlers with real browser focus.
// Audio is stubbed to avoid network requests and audible playback.
test('stopping TTS with a pointer releases focus for study shortcuts', async () => {
  const source = fs.readFileSync('components/DesktopApp.tsx', 'utf8');
  const capture = source.slice(source.indexOf('    const handleClickCapture ='), source.indexOf('    document.addEventListener("click", handleClickCapture, true);'))
    .replace('(event: MouseEvent)', '(event)');
  const keys = source.slice(source.indexOf('    const isEditableTarget ='), source.indexOf('    return () => window.removeEventListener("keydown", handleStudyKeyDown);'))
    .replace('(target: EventTarget | null)', '(target)')
    .replace('(e: KeyboardEvent)', '(e)');
  assert(capture.includes('stopImmediatePropagation'));
  assert(keys.includes('ArrowRight'));
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent('<span tabindex="0" role="button" data-tts-trigger="true">Listen to this example</span><input aria-label="editor">');
    await page.evaluate(({ capture, keys }) => {
      window.results = { plays: 0, stops: 0, next: 0, prev: 0, reveals: 0 };
      const trigger = document.querySelector('[data-tts-trigger]');
      const audioWindow = {};
      const isTtsTextHit = () => true;
      const stopAudio = audio => { audio.paused = true; window.results.stops++; };
      const step = 'study';
      const nextWord = () => window.results.next++;
      const prevWord = () => window.results.prev++;
      const setShowMeaning = () => window.results.reveals++;
      eval(capture + '\ndocument.addEventListener("click", handleClickCapture, true);');
      eval(keys);
      trigger.addEventListener('click', event => {
        if (event.detail > 0) trigger.blur();
        window.results.plays++;
        audioWindow.__vocabFlowActiveAudio = { paused: false, ended: false };
        audioWindow.__vocabFlowActiveAudioTrigger = trigger;
      });
      trigger.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        window.results.plays++;
      });
    }, { capture, keys });
    const trigger = page.locator('[data-tts-trigger]');
    await trigger.click();
    await trigger.click();
    assert.equal(await trigger.evaluate(el => document.activeElement === el), false);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => window.results), { plays: 1, stops: 1, next: 1, prev: 1, reveals: 1 });
    // Deliberate keyboard focus still supports accessible playback.
    await trigger.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.results.plays), 2);
    await page.getByRole('textbox').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => window.results.next), 1);
  } finally {
    await browser.close();
  }
});

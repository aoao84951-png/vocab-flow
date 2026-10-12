const { chromium, expect } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, nativePicker] of [[1280, true], [390, false]]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
      await context.addInitScript(({ nativePicker }) => {
        if (!nativePicker) {
          Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
          return;
        }
        window.showOpenFilePicker = async options => {
          window.coverPickerCall = { options, active: navigator.userActivation.isActive };
          const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XcAAAAASUVORK5CYII='), c => c.charCodeAt(0));
          return [{ getFile: async () => new File([bytes], 'cover.png', { type: 'image/png' }) }];
        };
      }, { nativePicker });
      await context.route('**/rest/v1/**', route => route.fulfill({ json: { id: 'test', data: [{ id: 'toeic', title: 'TOEIC', folders: [], days: [] }] } }));
      const page = await context.newPage();
      await page.goto(process.env.COVER_TEST_URL || 'http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '목차', exact: true }).click();
      await page.getByRole('button', { name: '단어장 추가', exact: true }).click();
      const button = page.getByRole('button', { name: '표지 선택', exact: true });
      const checkbox = page.getByRole('checkbox', { name: '표지 없는 책' });
      const buttonBox = await button.boundingBox();
      const checkboxBox = await checkbox.boundingBox();
      if (Math.abs(buttonBox.x - checkboxBox.x) > 5) throw new Error('Cover checkbox shifted from the button');
      if (nativePicker) {
        await button.click();
        const call = await page.evaluate(() => window.coverPickerCall);
        expect(call.active).toBe(true);
        expect(call.options.multiple).toBe(false);
      } else {
        const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
        await button.click();
        const chooser = await chooserPromise;
        await chooser.setFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XcAAAAASUVORK5CYII=', 'base64') });
      }
      await expect(page.getByAltText('선택한 책 표지')).toBeVisible();
      await page.getByRole('button', { name: '표지 없애기' }).click();
      await expect(page.getByAltText('선택한 책 표지')).toHaveCount(0);
      console.log(`${width}: picker path, preview, removal and checkbox alignment passed`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

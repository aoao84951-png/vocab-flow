const { chromium, expect } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
      await context.route('**/rest/v1/**', route => route.fulfill({ json: { id: 'test', data: [{ id: 'toeic', title: 'TOEIC', folders: [], days: [] }] } }));
      const page = await context.newPage();
      await page.goto(process.env.COVER_TEST_URL || 'http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '목차', exact: true }).click();
      await page.getByRole('button', { name: '단어장 추가', exact: true }).click();
      const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
      await page.getByLabel('책 표지 선택').click();
      const chooser = await chooserPromise;
      await chooser.setFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XcAAAAASUVORK5CYII=', 'base64') });
      await expect(page.getByAltText('선택한 책 표지')).toBeVisible();
      await page.getByRole('button', { name: '표지 없애기' }).click();
      await expect(page.getByAltText('선택한 책 표지')).toHaveCount(0);
      console.log(`${width}: native picker, preview and removal passed`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

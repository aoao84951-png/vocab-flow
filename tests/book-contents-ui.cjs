const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const folder = (id, title, folders = [], days = []) => ({ id, title, folders, days });
const day = (id, title, count) => ({ id, title, words: Array.from({ length: count }, (_, index) => ({ id: `${id}-${index}`, word: `word ${index}`, meanings: [{ pos: 'n.', items: ['뜻'] }], examples: [], synonyms: [], antonyms: [] })) });
const fixture = () => [folder('toeic', 'TOEIC', [{ ...folder('ets', 'ETS 토익 기출보카', [folder('lc', 'LC', [folder('part1', 'PART 1', [], [day('d1', 'DAY 01. 사진묘사 필수 어휘(1)', 47), day('extra1', '+ 토익 만점 완성', 54), day('d2', 'DAY 02. 사진묘사 필수 어휘(2)', 47), day('extra2', '+ 토익 만점 완성', 54)]), folder('part2', 'PART 2')]), folder('rc', 'RC')]), isBook: true }])];

(async () => {
  const browser = await chromium.launch();
  const output = process.env.TOC_SCREENSHOTS || '/tmp/vocab-flow-toc';
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block' });
      let data = fixture();
      const errors = [];
      await context.route('**/rest/v1/**', async route => {
        const req = route.request();
        if (req.method() === 'PATCH' || req.method() === 'POST') {
          data = req.postDataJSON().data;
          return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        }
        return route.fulfill({ json: { id: 'test-row', data } });
      });
      await context.addInitScript(() => {
        localStorage.setItem('voca-font', 'summer');
        if (!sessionStorage.getItem('vocab-flow-state')) sessionStorage.setItem('vocab-flow-state', JSON.stringify({ step: 'day', selectedBookId: 'toeic', folderPath: ['toeic', 'ets'], selectedDayId: '', wordIndex: 0 }));
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.TOC_URL || 'http://localhost:3100', { timeout: 60000 });
      const open = async () => { await page.getByRole('button', { name: '목차', exact: true }).click(); await expect(page.getByRole('dialog', { name: '목차' })).toBeVisible(); };
      await open();
      const dialog = page.getByRole('dialog', { name: '목차' });
      await expect(dialog.getByRole('button', { name: 'LC', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.getByRole('button', { name: 'PART 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const row = id => dialog.locator(`[data-folder-row="${id}"]`);
      const link = async (id, target) => {
        await row(id).hover();
        await row(id).getByRole('button', { name: /관리$/ }).click();
        await dialog.getByRole('button', { name: '보충 Day로 연결', exact: true }).click();
        await dialog.getByLabel('연결할 Day', { exact: true }).selectOption(target);
        await dialog.getByRole('button', { name: '연결', exact: true }).click();
        await expect(row(id)).toHaveAttribute('data-supplement-to', target);
        await expect.poll(() => data[0].folders[0].folders[0].folders[0].days.find(d => d.id === id).supplementTo).toBe(target);
      };
      await link('extra1', 'd1');
      await link('extra2', 'd2');
      await dialog.screenshot({ path: `${output}/contents-${width}.png` });
      assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
      const bounds = await dialog.locator('button').evaluateAll(buttons => buttons.filter(b => {
        const r = b.getBoundingClientRect();
        return r.width && (r.left < 0 || r.right > innerWidth + 1);
      }).map(b => b.textContent));
      assert.deepEqual(bounds, []);

      await dialog.getByRole('button', { name: 'RC', exact: true }).click();
      await expect(dialog.getByText('아직 등록된 Day가 없어요.')).toBeVisible();
      await dialog.getByRole('button', { name: 'LC', exact: true }).click();
      await dialog.getByRole('button', { name: 'PART 2', exact: true }).click();
      await dialog.getByRole('button', { name: '닫기', exact: true }).click();
      await open();
      await expect(dialog.getByRole('button', { name: 'PART 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await dialog.getByRole('button', { name: 'PART 1', exact: true }).click();

      await row('d2').hover();
      await row('d2').getByRole('button', { name: /관리$/ }).click();
      await dialog.getByRole('button', { name: '위로', exact: true }).click();
      await expect.poll(() => dialog.locator('[data-folder-kind="day"]').evaluateAll(rows => rows.map(row => row.dataset.folderRow))).toEqual(['d2', 'extra2', 'd1', 'extra1']);
      await dialog.getByRole('button', { name: 'Day 관리 닫기', exact: true }).click();

      await dialog.getByRole('button', { name: 'PART 2', exact: true }).click();
      await dialog.getByRole('button', { name: 'Day 추가', exact: true }).click();
      await expect(dialog.getByText('PART 2 안에 추가')).toBeVisible();
      await dialog.getByRole('textbox', { name: 'Day 이름', exact: true }).fill('새로운 Day');
      await dialog.getByRole('button', { name: '추가하기', exact: true }).click();
      await expect.poll(() => data[0].folders[0].folders[0].folders[1].days[0]?.title).toBe('새로운 Day');
      await dialog.getByRole('button', { name: 'PART 1', exact: true }).click();

      await page.reload();
      await open();
      await expect(row('extra1')).toHaveAttribute('data-supplement-to', 'd1');
      await row('extra1').hover();
      await row('extra1').getByRole('button', { name: /관리$/ }).click();
      await dialog.getByRole('button', { name: '연결 해제', exact: true }).click();
      await expect(row('extra1')).not.toHaveAttribute('data-supplement-to');
      await expect.poll(() => data[0].folders[0].folders[0].folders[0].days.find(d => d.id === 'extra1').supplementTo).toBeUndefined();
      await row('extra2').getByRole('button').first().click();
      await expect(dialog).not.toBeVisible();
      await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('vocab-flow-state')).selectedDayId)).toBe('extra2');
      await open();
      await expect(row('extra2').getByRole('button').first()).toHaveAttribute('aria-current', 'page');
      await row('extra2').hover();
      await row('extra2').getByRole('button', { name: /관리$/ }).click();
      await dialog.getByRole('button', { name: '상위 목차로 이동', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('vocab-flow-state')).folderPath)).toEqual(['toeic', 'ets', 'lc']);
      await open();
      await expect(dialog.getByRole('button', { name: '직접 등록한 Day', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(row('extra2')).not.toHaveAttribute('data-supplement-to');
      await expect.poll(() => data[0].folders[0].folders[0].days.find(d => d.id === 'extra2')?.words.length).toBe(54);
      await row('extra2').hover();
      await row('extra2').getByRole('button', { name: /관리$/ }).click();
      await dialog.getByRole('button', { name: '다른 목차로 이동', exact: true }).click();
      await dialog.getByLabel('이동할 목차', { exact: true }).selectOption('rc');
      await dialog.screenshot({ path: `${output}/move-day-${width}.png` });
      assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
      await dialog.getByRole('button', { name: '여기로 이동', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect.poll(() => data[0].folders[0].folders[1].days.find(d => d.id === 'extra2')?.words.length).toBe(54);
      await open();
      await dialog.getByRole('button', { name: 'LC', exact: true }).click();
      await dialog.getByRole('button', { name: 'PART 1', exact: true }).click();
      await row('d1').hover();
      await row('d1').getByRole('button', { name: /관리$/ }).click();
      await dialog.getByRole('button', { name: '상위 목차로 이동', exact: true }).click();
      await expect(dialog).toBeVisible();
      await expect(row('d1')).toBeVisible();
      await expect(dialog.getByRole('button', { name: '직접 등록한 Day', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => data[0].folders[0].folders[0].days.find(d => d.id === 'd1')?.words.length).toBe(47);
      await page.reload();
      await open();
      await dialog.getByRole('button', { name: 'LC', exact: true }).click();
      await expect(row('d1')).toBeVisible();
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: selectors, link/unlink, group reorder, add destination, persisted reload, independent Day navigation, layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

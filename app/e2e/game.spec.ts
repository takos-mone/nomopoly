import { expect, test } from '@playwright/test';
test('plays in 3D, inspects a property, switches views, and resumes its independent save', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('nomopoly-savegame', 'existing-product-save'); localStorage.setItem('nomopoly-3d-muted', '1'); Math.random = () => 0.2; });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /飲もポリー/ })).toBeVisible();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-setup.png`, fullPage: true });
  await page.getByPlaceholder('プレイヤー1の名前').fill('あき');
  await page.getByRole('button', { name: 'ゲーム開始', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('街の灯りをつけています…')).toHaveCount(0);
  // 3DのマスはメッシュでありDOMに出ないため、全40マスが操作できることは一覧側で担保する。
  await expect(page.locator('.world-directory button')).toHaveCount(40);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-world.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'コマを追う' }).click();
  await expect(page.getByRole('button', { name: 'コマを追う' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '街並みを見る' }).click();
  await expect(page.getByRole('button', { name: '街並みを見る' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '全体を見る' }).click();
  await page.getByRole('button', { name: '🔄 回転' }).click();
  await expect(page.getByRole('button', { name: '✋ 移動' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.world-directory summary').click();
  await page.locator('.world-directory button').nth(1).click();
  await expect(page.locator('.modal-box')).toBeVisible();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: '平面表示', exact: true }).click();
  await expect(page.locator('.board-square')).toHaveCount(40);
  await page.getByRole('button', { name: '3D表示', exact: true }).click();
  await page.getByRole('button', { name: 'サイコロを振る', exact: true }).click();
  await page.getByRole('button', { name: 'ストップ!', exact: true }).click();
  await page.getByRole('button', { name: '4マス進む', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nomopoly-3d-savegame')!).state.players[0].position)).toBe(4);
  await page.reload();
  await page.getByRole('button', { name: '続きから再開する', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('nomopoly-savegame'))).toBe('existing-product-save');
  expect(errors).toEqual([]);
});

test('names a bought property, then wipes it clean on bankruptcy', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let i = 0;
    const seq = [0.05, 0.3];
    Math.random = () => seq[i++ % seq.length];
    localStorage.setItem('nomopoly-3d-muted', '1');
  });
  await page.goto('/');
  await page.getByPlaceholder('プレイヤー1の名前').fill('あき');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'ゲーム開始', exact: true }).click();
  await expect(page.getByText('街の灯りをつけています…')).toHaveCount(0);

  const clearNotices = async () => {
    for (let i = 0; i < 8; i += 1) {
      const overlay = page.locator('.notice-overlay');
      if ((await overlay.count()) === 0) return;
      await overlay.first().click();
      await page.waitForTimeout(320);
    }
  };

  await page.getByRole('button', { name: 'サイコロを振る', exact: true }).click();
  await page.getByRole('button', { name: 'ストップ!', exact: true }).click();
  await page.getByRole('button', { name: '3マス進む', exact: true }).click();
  await page.waitForTimeout(2000);
  await clearNotices();

  await page.getByRole('button', { name: '購入する', exact: true }).click();
  await page.getByRole('button', { name: '飲み終えた', exact: true }).click();

  // 命名モードなので、取得の通知より先に名前を聞かれる
  await expect(page.getByRole('heading', { name: /店の名前を決める/ })).toBeVisible();
  await page.locator('.naming-modal__input').fill('あきの止まり木');
  await page.locator('.naming-modal__actions .primary-button').click();
  await clearNotices();
  await expect(page.locator('.world-directory')).toContainText('あきの止まり木');

  // 自己破産すると、その物件は元の名前の更地に戻る
  await page.getByRole('button', { name: '🏳️ 自己破産(降参)する' }).click();
  await page.getByRole('button', { name: 'はい、降ります' }).click();
  await clearNotices();
  await expect(page.locator('.world-directory')).not.toContainText('あきの止まり木');
  await expect(page.locator('.world-directory')).toContainText('せんべろ屋 二号店');
  expect(errors).toEqual([]);
});

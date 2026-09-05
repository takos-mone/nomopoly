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
  // カメラはモードを持たず、盤に触れている間だけ追従をやめる。
  // 触ったら「コマに戻す」が現れ、押すと消えて追従に戻る。
  await expect(page.getByRole('button', { name: /コマに戻す/ })).toHaveCount(0);
  await page.locator('.world-viewport canvas').hover();
  await page.mouse.down();
  await page.mouse.move(320, 260, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: /コマに戻す/ })).toBeVisible();
  await page.getByRole('button', { name: /コマに戻す/ }).click();
  await expect(page.getByRole('button', { name: /コマに戻す/ })).toHaveCount(0);
  await page.locator('.world-directory summary').click();
  await page.locator('.world-directory button').nth(1).click();
  await expect(page.locator('.modal-box')).toBeVisible();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  // 全画面プレイ: 盤だけが残り、ヘッダーとサイドバーは隠れる
  await page.getByRole('button', { name: /⛶ 全画面/ }).click();
  await expect(page.locator('.world-board--immersive')).toBeVisible();
  await expect(page.locator('.app-header')).toBeHidden();
  await expect(page.locator('.app-layout__sidebar')).toBeHidden();
  await page.getByRole('button', { name: /全画面をやめる/ }).click();
  await expect(page.locator('.world-board--immersive')).toHaveCount(0);
  await expect(page.locator('.app-header')).toBeVisible();

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

/**
 * 出目を常に1と1にしておき、ゲーム開始から2マス進んで
 * 「共同基金カード」のマスでカードを1枚引かせる。
 */
async function drawFirstCard(page: import('@playwright/test').Page, flat: boolean) {
  await page.addInitScript(() => {
    Math.random = () => 0.05;
    localStorage.setItem('nomopoly-3d-muted', '1');
  });
  await page.goto('/');
  await page.getByPlaceholder('プレイヤー1の名前').fill('あき');
  await page.getByRole('button', { name: 'ゲーム開始', exact: true }).click();
  await expect(page.getByText('街の灯りをつけています…')).toHaveCount(0);
  if (flat) await page.getByRole('button', { name: '平面表示', exact: true }).click();
  await page.getByRole('button', { name: 'サイコロを振る', exact: true }).click();
  await page.getByRole('button', { name: 'ストップ!', exact: true }).click();
  await page.getByRole('button', { name: '2マス進む', exact: true }).click();
  // 着地の通知を送ると、カードを引く通知に変わる
  await expect(page.locator('.notice-card__title')).toHaveText('共同基金カード');
  await page.locator('.notice-overlay').click();
}

test('prints the drawn card effect on the 3D card instead of a popup', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await drawFirstCard(page, false);
  // 効果はカード面に刷り込まれている。盤を隠す説明のポップアップは出さない。
  await expect(page.locator('.notice-overlay--bare')).toBeVisible();
  await expect(page.locator('.notice-card')).toHaveCount(0);
  await expect(page.locator('.world-waiting')).toHaveText('カードを読んだらタップして次へ');
  expect(errors).toEqual([]);
});

test('keeps the card effect popup in the flat view', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await drawFirstCard(page, true);
  // 平面表示にはカードの3D演出がないので、これまで通り説明をポップアップで出す
  await expect(page.locator('.notice-card__detail')).toBeVisible();
  await expect(page.locator('.notice-overlay--bare')).toHaveCount(0);
  expect(errors).toEqual([]);
});

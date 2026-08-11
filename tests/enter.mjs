/**
 * Gets from a cold load to a mounted game, whatever the boot screens happen to be.
 *
 * The suites written before slots existed assumed the game mounted straight away. It no longer does:
 * there is a login page (when online is configured) and always a slot picker. Rather than teaching each
 * suite the sequence, they all call this — so a future boot-screen change is one edit here, not five.
 *
 * Loops on observed state rather than following a fixed script, because which screens appear depends on
 * whether online is configured and whether slot 1 already holds a save.
 */
export async function enterGame(page, { timeout = 20000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.locator('.app').count()) return true;

    // Slot picker: play slot 1 if it holds a save, otherwise create an SSF save there.
    const rows = page.locator('.slots__item');
    if (await rows.count()) {
      const first = rows.first();
      const play = first.locator('.slots__btn--primary', { hasText: 'Play' });
      if (await play.count()) {
        await play.click();
        await page.waitForTimeout(2600);
        continue;
      }
      const fresh = first.locator('.slots__new');
      if (await fresh.count()) {
        await fresh.click();
        await page.waitForTimeout(300);
        await first.locator('.slots__btn', { hasText: /^SSF$/ }).click();
        await page.waitForTimeout(3000);
        continue;
      }
    }

    // Login page. Matched on the button's text, because `.gate__offline` is also the picker's
    // "Sign Out" / "Sign In For Online Saves" button and clicking that here would loop forever.
    const offline = page.locator('.gate__offline').first();
    if (await offline.count() && /play offline/i.test((await offline.textContent()) ?? '')) {
      await offline.click();
      await page.waitForTimeout(1200);
      continue;
    }

    await page.waitForTimeout(300);
  }
  return (await page.locator('.app').count()) > 0;
}

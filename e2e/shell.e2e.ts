import { test, expect, scanFromLanding } from './fixtures';

test.describe('UI shell', () => {
  test('the theme toggle flips the theme and the choice survives a reload', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    const toggle = ext.getByRole('button', { name: 'Dark theme' });
    const startDark = (await toggle.getAttribute('aria-pressed')) === 'true';
    const next = startDark ? 'light' : 'dark';

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', String(!startDark));
    await expect.poll(() => ext.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!startDark);
    await expect.poll(() => ext.evaluate(async () => (await chrome.storage.local.get('theme')).theme)).toBe(next);

    await ext.reload();
    await expect(ext.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', String(!startDark));
  });

  test('keyboard shortcuts: ? opens help, a digit picks a tab, r re-scans', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await scanFromLanding(ext);

    await ext.keyboard.press('Shift+Slash');
    const help = ext.getByRole('dialog').filter({ has: ext.locator('#shortcuts-help-title') });
    await expect(help).toBeVisible();
    await ext.keyboard.press('Escape');
    await expect(help).toHaveCount(0);

    await ext.keyboard.press('3');
    await expect(ext.getByRole('tab', { name: 'Audit', exact: true })).toHaveAttribute('aria-selected', 'true');

    await ext.keyboard.press('r');
    // A successful re-scan lands back on Tags.
    await expect(ext.getByRole('tab', { name: 'Tags', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  test('the settings drawer opens from the toolbar and closes', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await ext.getByRole('button', { name: 'Settings' }).click();
    const drawer = ext.getByRole('dialog').filter({ has: ext.locator('#settings-drawer-title') });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('radiogroup', { name: 'Surface' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Close settings' }).click();
    await expect(drawer).toHaveCount(0);
  });
});

test.describe('background service worker', () => {
  test('applies the stored surface mode to the toolbar action', async ({ openSurface, background }) => {
    const { ext } = await openSurface('/');
    await ext.evaluate(() => chrome.storage.local.set({ mode: 'popup' }));
    await expect.poll(() => background.evaluate(() => chrome.action.getPopup({}))).toMatch(/\/index\.html$/);

    await ext.evaluate(() => chrome.storage.local.set({ mode: 'sidepanel' }));
    await expect.poll(() => background.evaluate(() => chrome.action.getPopup({}))).toBe('');
  });
});

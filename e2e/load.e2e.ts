import { test, expect } from './fixtures';

test.describe('extension load', () => {
  test('background service worker registers and the extension page opens on the landing view', async ({ openSurface, extensionId, background, backgroundErrors }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/);
    const { ext, pageErrors } = await openSurface('/');
    await expect(ext).toHaveTitle('Metaspry');
    await expect(ext.getByRole('heading', { name: "Scan this page's meta tags" })).toBeVisible();
    await expect(ext.getByRole('button', { name: 'Scan this page' })).toBeEnabled();
    await expect(ext.getByRole('toolbar', { name: 'Extension controls' })).toBeVisible();
    expect(pageErrors).toEqual([]);
    // background.js ran its top-level setup (mode + context menu) without logging an error.
    await expect.poll(() => background.evaluate(() => chrome.action.getPopup({}))).toBe('');
    expect(backgroundErrors).toEqual([]);
  });
});

import { test, expect, scanFromLanding } from './fixtures';

// UX review 2026-10-25, Medium 13: at bottom-4 a toast sat over the Re-scan button for up to 9 s in
// a 320 px side panel.

test('a toast in a narrow panel never covers the Re-scan button', async ({ openSurface }) => {
  const { ext } = await openSurface('/');
  await ext.setViewportSize({ width: 320, height: 640 });
  // Measure where the toast rests, not mid fly-in (motion.ts drops transitions under reduced motion).
  await ext.emulateMedia({ reducedMotion: 'reduce' });
  await ext.evaluate(() => {
    navigator.clipboard.writeText = async () => {};
  });
  await scanFromLanding(ext);
  await ext.getByRole('button', { name: 'Copy og:title value' }).click();

  const toast = ext.getByRole('status').filter({ hasText: /Copied/ }).locator('div').first();
  await expect(toast).toBeVisible();
  const t = (await toast.boundingBox())!;
  const r = (await ext.getByRole('button', { name: 'Re-scan this page' }).boundingBox())!;
  const overlap = t.y < r.y + r.height && r.y < t.y + t.height && t.x < r.x + r.width && r.x < t.x + t.width;
  expect(overlap).toBe(false);
});

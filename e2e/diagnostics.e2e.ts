import { test, expect, scanFromLanding, openTab } from './fixtures';

// Architecture review 2026-10-26, Medium 16: absorbed failures are kept for a bug report and
// Settings > "Copy diagnostics" puts them on the clipboard. CDP cannot grant clipboard access to an
// extension origin, so the page's writeText is replaced with a recorder.

test('a failed Compare fetch shows up in the copied diagnostics', async ({ openSurface }) => {
  const { ext } = await openSurface('/');
  await ext.evaluate(() => {
    const w = window as unknown as { __copied: string };
    w.__copied = '';
    navigator.clipboard.writeText = async (t: string) => {
      w.__copied = t;
    };
  });
  await scanFromLanding(ext);

  await openTab(ext, 'Compare');
  const panel = ext.getByRole('tabpanel');
  await panel.getByRole('textbox', { name: 'URL to compare' }).fill('http://127.0.0.1:1/unreachable');
  await panel.getByRole('button', { name: 'Compare' }).click();
  await expect(panel.getByRole('button', { name: 'Compare' })).toHaveAttribute('aria-busy', 'false', { timeout: 15_000 });

  await ext.getByRole('button', { name: 'Settings' }).click();
  await ext.getByRole('button', { name: 'Copy diagnostics' }).click();
  await expect(ext.getByText('Diagnostics copied', { exact: false })).toBeVisible();

  const text = await ext.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(text).toMatch(/^Metaspry \d+\.\d+\.\d+\nBrowser: .+\nSurface: sidepanel\nEntries: [1-9]/);
  expect(text).toContain('compare.fetch: ');
});

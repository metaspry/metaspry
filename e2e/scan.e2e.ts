import { test, expect, scanFromLanding, openTab, setActiveTabUrl, SITE } from './fixtures';

test.describe('scan pipeline', () => {
  test('scans the host window\'s active tab through background.js and fills every result tab', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await scanFromLanding(ext);

    // The page the results belong to (E-1).
    await expect(ext.getByText('Results for 127.0.0.1:4319')).toBeAttached();

    // Tags: the captured document's own values, not a cached copy.
    await expect(ext.getByRole('tab', { name: 'Tags', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(ext).toHaveTitle('Metaspry - Tags');
    // Hidden panels stay mounted (they keep their state), so look inside the visible one only.
    const main = ext.getByRole('tabpanel');
    await expect(main.getByText('Fixture Home - Metaspry E2E').first()).toBeVisible();
    await expect(main.getByText('A fixture page with a complete set of meta tags', { exact: false }).first()).toBeVisible();
    await expect(main.getByText('Fixture OG Title').first()).toBeVisible();
    await expect(main.getByText(`${SITE}/`, { exact: true }).first()).toBeVisible(); // canonical

    await openTab(ext, 'Previews');
    await expect(main.getByText('Fixture OG Title').first()).toBeVisible();

    await openTab(ext, 'Audit');
    await expect(main.getByRole('heading', { name: 'SEO Health' })).toBeVisible();
    await expect(main.getByRole('img', { name: /^Score \d{1,3} of 100, / })).toBeVisible();

    await openTab(ext, 'Site');
    // Fetched live from the fixture server.
    await expect(main.getByRole('heading', { name: 'robots.txt' })).toBeVisible();
    await expect(main.getByText('1 user-agent group(s) · 1 sitemap directive(s)')).toBeVisible();
    await expect(main.getByRole('heading', { name: 'llms.txt' })).toBeVisible();

    await openTab(ext, 'AI');
    // The llms.txt check reads the file fetched from the fixture site (`# ` heading + `## ` section).
    await expect(main.getByText('Present and well-formed.', { exact: false })).toBeVisible();

    await openTab(ext, 'Compare');
    await expect(ext).toHaveTitle('Metaspry - Compare');
  });

  test('a page with no meta tags opens the audit with what to add, and is kept in History', async ({ openSurface }) => {
    const { ext } = await openSurface('/empty.html');
    await ext.getByRole('button', { name: 'Scan this page' }).click();
    await expect(ext.getByRole('complementary', { name: 'No meta tags found' })).toContainText('The Audit tab below lists what to add');
    await expect(ext.getByRole('tab', { name: 'Audit', exact: true })).toHaveAttribute('aria-selected', 'true');
    const panel = ext.getByRole('tabpanel');
    await expect(panel.getByRole('img', { name: /^Score \d{1,3} of 100, / })).toBeVisible();
    await expect(panel.getByText('Fail: Page title', { exact: false })).toBeAttached();
    await expect
      .poll(async () => (await ext.evaluate(async () => (await chrome.storage.local.get('history')).history as { url: string }[] | undefined))?.[0]?.url)
      .toBe(`${SITE}/empty.html`);
  });

  test('a browser page Chrome blocks shows the error state with a plain reason', async ({ openSurface, background }) => {
    const { ext, windowId } = await openSurface('/');
    await setActiveTabUrl(background, windowId, 'chrome://version/');
    await ext.getByRole('button', { name: 'Scan this page' }).click();
    await expect(ext.getByRole('heading', { name: "Couldn't scan this page" })).toBeVisible();
    await expect(ext.getByText('Chrome blocks extensions on a browser settings page', { exact: false }).first()).toBeVisible();
  });

  test('scans record a History entry that survives a reload', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await scanFromLanding(ext);
    await expect
      .poll(async () => {
        const stored = await ext.evaluate(async () => (await chrome.storage.local.get('history')).history as { url: string; title: string }[] | undefined);
        return stored?.[0];
      })
      .toMatchObject({ url: `${SITE}/`, title: 'Fixture Home - Metaspry E2E' });

    await ext.reload();
    await ext.getByRole('button', { name: 'History' }).click();
    await expect(ext.getByRole('dialog', { name: 'Recent scans' }).getByText('Fixture Home - Metaspry E2E')).toBeVisible();
  });
});

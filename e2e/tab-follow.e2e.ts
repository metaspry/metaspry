import { test, expect, scanFromLanding, setActiveTabUrl, SITE } from './fixtures';

const BANNER = 'Results are for another page';

test.describe('stale-tab tracking (E-1, E-19)', () => {
  test('navigating the scanned tab flags the results; "Scan this tab" scans the new page', async ({ openSurface }) => {
    const { ext, site } = await openSurface('/');
    await scanFromLanding(ext);
    await expect(ext.getByRole('complementary', { name: BANNER })).toHaveCount(0);

    await site.goto(`${SITE}/other.html`);
    const banner = ext.getByRole('complementary', { name: BANNER });
    await expect(banner).toContainText('This tab changed. Results are for 127.0.0.1:4319.');
    // The banner's button and the bottom re-scan button both offer it.
    await expect(ext.getByRole('button', { name: 'Scan this tab' })).toHaveCount(2);

    await banner.getByRole('button', { name: 'Scan this tab' }).click();
    await expect(banner).toHaveCount(0);
    await expect(ext.getByText('Results for 127.0.0.1:4319/other.html')).toBeAttached();
    await expect(ext.getByRole('main').getByText('Other Fixture Page').first()).toBeVisible();
    await expect(ext.getByRole('button', { name: 'Re-scan this page' })).toBeEnabled();
  });

  test('a hash route is a page change; a #section jump is not', async ({ openSurface }) => {
    const { ext, site } = await openSurface('/');
    await scanFromLanding(ext);
    const banner = ext.getByRole('complementary', { name: BANNER });

    await site.evaluate(() => (location.hash = '/pricing'));
    await expect(banner).toBeVisible();

    // Back to the scanned route via a plain anchor: the banner has to go away, which only happens
    // once the page has seen this navigation and judged it the same page.
    await site.evaluate(() => (location.hash = 'section'));
    await expect(banner).toHaveCount(0);
    await expect(ext.getByRole('button', { name: 'Re-scan this page' })).toBeVisible();
  });

  test('a failed re-scan keeps the results on screen and says why', async ({ openSurface }) => {
    const { ext, site } = await openSurface('/');
    await scanFromLanding(ext);

    // Connection refused: Chrome shows its error page, which no extension can script, at a URL the
    // restricted-page check does not recognise - so a re-scan is offered, and then fails.
    await site.goto('http://127.0.0.1:1/').catch(() => undefined);
    await ext.getByRole('complementary', { name: BANNER }).getByRole('button', { name: 'Scan this tab' }).click();

    const notice = ext.getByRole('complementary', { name: 'Scan failed, results kept' });
    await expect(notice).toContainText("Couldn't scan 127.0.0.1:1");
    await expect(notice).toContainText('Results are still for 127.0.0.1:4319.');
    await expect(ext.getByRole('tablist')).toBeVisible();
    await expect(ext.getByRole('main').getByText('Fixture Home - Metaspry E2E').first()).toBeVisible();
  });

  test('on a page Chrome blocks, the banner names it and re-scan is disabled', async ({ openSurface, background }) => {
    const { ext, windowId } = await openSurface('/');
    await scanFromLanding(ext);

    await setActiveTabUrl(background, windowId, 'chrome://version/');

    await expect(ext.getByRole('complementary', { name: BANNER })).toContainText(
      'This tab is a browser settings page; Chrome blocks extensions there.',
    );
    await expect(ext.getByRole('button', { name: 'Scan this tab' })).toBeDisabled();
  });
});

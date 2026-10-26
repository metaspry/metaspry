import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, scanFromLanding, openTab, SITE } from './fixtures';

// The fixes for the 2026-10-25 hostile UI/UX review (openspec 2026-10-25-ux-critical-high).

test.describe('Audit explains itself (items 2, 9)', () => {
  test('every rule states its verdict as text; failing rules say why and what they cost', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await scanFromLanding(ext);
    await openTab(ext, 'Audit');
    const panel = ext.getByRole('tabpanel');

    // The fixture has no og:image: a failing required rule.
    const ogImage = panel.locator('p', { hasText: 'Open Graph image' }).filter({ hasText: /^Fail: / });
    await expect(ogImage).toHaveCount(1);
    await expect(panel.getByText('og:image is the thumbnail used by every major platform.', { exact: false })).toBeVisible();
    await expect(panel.getByText(/−\d+(\.\d)? pts/).first()).toBeVisible();
    // Not an article page: not applicable, not a green pass.
    await expect(panel.getByText('Not applicable: Article OG metadata', { exact: false })).toBeAttached();
    await expect(panel.getByText('Pass: Page title', { exact: false })).toBeAttached();
    // The formula, for a free user.
    await expect(panel.getByText('Each rule earns its weight when it passes', { exact: false })).toBeVisible();
  });
});

test.describe('Compare does not rely on colour (item 3)', () => {
  test('each row carries a text status; columns are labelled; "differences only" filters', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await scanFromLanding(ext);
    await openTab(ext, 'Compare');
    const panel = ext.getByRole('tabpanel');
    await panel.getByRole('textbox', { name: 'URL to compare' }).fill(`${SITE}/other.html`);
    await panel.getByRole('button', { name: 'Compare' }).click();

    const list = panel.getByRole('list', { name: 'Tag differences' });
    const titleRow = list.getByRole('listitem').filter({ hasText: /^title/ });
    await expect(titleRow).toContainText('Different');
    await expect(titleRow).toContainText('Current: Fixture Home - Metaspry E2E');
    await expect(titleRow).toContainText('Compared: Other Fixture Page');
    await expect(list.getByRole('listitem').filter({ hasText: /^og:title/ })).toContainText('Only on current');
    await expect(panel.getByRole('status').filter({ hasText: /tags differ/ })).toBeVisible();

    const total = await list.getByRole('listitem').count();
    await panel.getByRole('checkbox', { name: 'Show differences only' }).check();
    await expect(list.getByRole('listitem').filter({ hasText: 'Same' })).toHaveCount(0);
    expect(await list.getByRole('listitem').count()).toBeLessThanOrEqual(total);
  });
});

test.describe('the AI tab agrees with Audit on indexability (item 5)', () => {
  test('a page de-indexed only by X-Robots-Tag fails in Audit and is not "indexable" in AI', async ({ openSurface }) => {
    const { ext } = await openSurface('/noindex-header.html');
    await scanFromLanding(ext);
    await openTab(ext, 'Audit');
    await expect(ext.getByRole('tabpanel').getByText('Fail: Indexable by search engines', { exact: false })).toBeAttached();

    await openTab(ext, 'AI');
    await expect(ext.getByRole('tabpanel').getByText('the same finding as Audit > Indexable by search engines', { exact: false })).toBeVisible();
  });
});

test.describe('dialogs own the keyboard (item 6)', () => {
  test('behind Settings, digit shortcuts do nothing and the page is inert', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await scanFromLanding(ext);
    await ext.getByRole('button', { name: 'Settings' }).click();
    const drawer = ext.getByRole('dialog').filter({ has: ext.locator('#settings-drawer-title') });
    await expect(drawer).toBeVisible();

    await ext.keyboard.press('3');
    await ext.keyboard.press('r');
    await expect(ext.locator('[role="tab"][aria-selected="true"]')).toHaveText('Tags');
    expect(await ext.locator('main').evaluate((el) => el.closest('[inert]') !== null)).toBe(true);
  });

  test('help over Settings keeps Tab to itself and Escape closes only the help', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await ext.getByRole('button', { name: 'Settings' }).click();
    const drawer = ext.getByRole('dialog').filter({ has: ext.locator('#settings-drawer-title') });
    await expect(drawer).toBeVisible();

    await ext.keyboard.press('Shift+Slash');
    const help = ext.getByRole('dialog').filter({ has: ext.locator('#shortcuts-help-title') });
    await expect(help).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await ext.keyboard.press('Tab');
      expect(await help.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }

    await ext.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await expect(drawer).toBeVisible();
    // Focus comes back into the drawer (it was inert while the help was on top).
    await expect.poll(() => drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await ext.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    // ...and to the control that opened Settings once the page behind is no longer inert.
    await expect(ext.getByRole('button', { name: 'Settings' })).toBeFocused();
  });

  test('closing the shortcuts help returns focus to the ? button', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await ext.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    const help = ext.getByRole('dialog').filter({ has: ext.locator('#shortcuts-help-title') });
    await expect(help).toBeVisible();
    await ext.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await expect(ext.getByRole('button', { name: 'Keyboard shortcuts' })).toBeFocused();
  });
});

test.describe('surface switching is explicit (item 4)', () => {
  test('arrowing onto "Popup" does not switch or close; it offers a labelled Switch button', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await ext.getByRole('button', { name: 'Settings' }).click();
    const radio = ext.getByRole('radio', { name: /Side panel/ });
    await radio.focus();
    await ext.keyboard.press('ArrowRight');
    await expect(ext.getByRole('radio', { name: /Popup/ })).toBeChecked();

    await expect(ext.getByRole('button', { name: 'Switch to popup' })).toBeVisible();
    await expect(ext.getByText('This window closes and Metaspry opens as a popup.', { exact: false })).toBeVisible();
    expect(ext.isClosed()).toBe(false);
    expect(await ext.evaluate(async () => (await chrome.storage.local.get('mode')).mode ?? 'sidepanel')).toBe('sidepanel');
  });
});

test.describe('scans are announced and focus lands on the results (item 7)', () => {
  test('the polite status says the score and the selected tab has focus', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await ext.getByRole('button', { name: 'Scan this page' }).click();
    await expect(ext.getByRole('status').filter({ hasText: /^Scan complete\. Score \d{1,3} of 100, / })).toBeAttached();
    await expect(ext.getByRole('tab', { name: 'Tags', exact: true })).toBeFocused();
  });
});

test.describe('panels keep their state (item 10)', () => {
  test('Compare and the Tags search survive a tab switch; Site and AI share one fetch', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    const robotsRequests: string[] = [];
    ext.on('request', (r) => {
      if (r.url() === `${SITE}/robots.txt`) robotsRequests.push(r.url());
    });
    await scanFromLanding(ext);

    const search = ext.getByRole('tabpanel').locator('input[data-shortcut="search"]');
    await search.fill('og:');

    await openTab(ext, 'Compare');
    await ext.getByRole('tabpanel').getByRole('textbox', { name: 'URL to compare' }).fill(`${SITE}/other.html`);
    await ext.getByRole('tabpanel').getByRole('button', { name: 'Compare' }).click();
    await expect(ext.getByRole('tabpanel').getByRole('list', { name: 'Tag differences' })).toBeVisible();

    await openTab(ext, 'Tags');
    await expect(ext.getByRole('tabpanel').locator('input[data-shortcut="search"]')).toHaveValue('og:');
    await openTab(ext, 'Compare');
    await expect(ext.getByRole('tabpanel').getByRole('textbox', { name: 'URL to compare' })).toHaveValue(`${SITE}/other.html`);
    await expect(ext.getByRole('tabpanel').getByRole('list', { name: 'Tag differences' })).toBeVisible();

    await openTab(ext, 'Site');
    await expect(ext.getByRole('tabpanel').getByRole('heading', { name: 'robots.txt' })).toBeVisible();
    await openTab(ext, 'AI');
    await expect(ext.getByRole('tabpanel').getByText('Present and well-formed.', { exact: false })).toBeVisible();
    await openTab(ext, 'Site');
    await openTab(ext, 'AI');
    expect(robotsRequests).toHaveLength(1);
  });
});

test.describe('steady, light open (items 11, 12)', () => {
  test('a stored dark theme is on <html> before the app starts', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await ext.getByRole('button', { name: 'Dark theme' }).click();
    await expect(ext.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true');
    await ext.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { __darkAtDcl: boolean }).__darkAtDcl = document.documentElement.classList.contains('dark');
      });
    });
    await ext.reload();
    expect(await ext.evaluate(() => (window as unknown as { __darkAtDcl?: boolean }).__darkAtDcl)).toBe(true);
  });

  test('a signed-out open and scan never load the Firebase SDK', async ({ openSurface }) => {
    const { ext, extensionIdFromPage } = await (async () => {
      const s = await openSurface('/');
      return { ext: s.ext, extensionIdFromPage: new URL(s.ext.url()).host };
    })();
    const loaded = new Set<string>();
    ext.on('request', (r) => {
      const u = new URL(r.url());
      if (u.host === extensionIdFromPage && u.pathname.endsWith('.js')) loaded.add(u.pathname);
    });
    await ext.reload();
    await scanFromLanding(ext);
    await expect(ext.getByRole('button', { name: 'Sign in' })).toBeVisible();
    const sdk = [...loaded].filter((p) => readFileSync(resolve('build', `.${p}`), 'utf8').includes('@firebase/'));
    expect(loaded.size).toBeGreaterThan(0);
    expect(sdk).toEqual([]);
  });

  test('only the shell blurs: no per-card backdrop-filter in the results', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await scanFromLanding(ext);
    const blurred = await ext.evaluate(
      () => Array.from(document.querySelectorAll('*')).filter((el) => getComputedStyle(el).backdropFilter !== 'none').length,
    );
    expect(blurred).toBeLessThanOrEqual(1);
  });
});

test.describe('Compare explains what happened (UX review 2026-10-25, Medium 18)', () => {
  test('a missing page reads "Page not found", not a raw status line', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await scanFromLanding(ext);
    await openTab(ext, 'Compare');
    const panel = ext.getByRole('tabpanel');
    await panel.getByRole('textbox', { name: 'URL to compare' }).fill(`${SITE}/does-not-exist.html`);
    await panel.getByRole('button', { name: 'Compare' }).click();
    await expect(panel.getByRole('alert')).toHaveText('Page not found (HTTP 404). Check the URL.');
  });

  test('a URL that redirects to a sign-in page says so above the rows', async ({ openSurface }) => {
    const { ext } = await openSurface('/');
    await scanFromLanding(ext);
    await openTab(ext, 'Compare');
    const panel = ext.getByRole('tabpanel');
    await panel.getByRole('textbox', { name: 'URL to compare' }).fill(`${SITE}/members-only.html`);
    await panel.getByRole('button', { name: 'Compare' }).click();
    await expect(panel.getByText(`This URL redirected to ${SITE}/login.html.`, { exact: false })).toBeVisible();
    await expect(panel.getByRole('list', { name: 'Tag differences' })).toBeVisible();
  });
});

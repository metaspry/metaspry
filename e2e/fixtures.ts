import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** The fixture site (e2e/server.mjs). The port is fixed: e2e/site/ hardcodes it in canonical, og:url and robots.txt. */
export const SITE = 'http://127.0.0.1:4319';
const BUILD = resolve('build');

export type Surface = {
  /** The extension page (build/index.html) - the same document the side panel and popup show. */
  ext: Page;
  /** The page being scanned: the active tab of its own window. */
  site: Page;
  /** That window's id; the extension page treats it as its host window. */
  windowId: number;
  /** Errors thrown in the extension page (uncaught exceptions only, not console noise). */
  pageErrors: Error[];
};

type Fixtures = {
  context: BrowserContext;
  background: Worker;
  /** Errors from the service worker and uncaught errors anywhere in the context; must stay empty. */
  backgroundErrors: string[];
  extensionId: string;
  /**
   * Opens `path` on the fixture site in a new window, then the extension page in a tab whose
   * `chrome.windows.getCurrent()` answers with that window - the stand-in for a side panel docked
   * in it. Everything else is real: background.js, runtime messaging, scripting.executeScript, tabs
   * events, chrome.storage and the network fetches.
   */
  openSurface: (path?: string) => Promise<Surface>;
};

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const profile = mkdtempSync(join(tmpdir(), 'metaspry-e2e-'));
    const context = await chromium.launchPersistentContext(profile, {
      // Extensions need Chromium's new headless mode, which `channel: 'chromium'` selects.
      channel: 'chromium',
      headless: !process.env.HEADED || process.env.HEADED === '0',
      args: [`--disable-extensions-except=${BUILD}`, `--load-extension=${BUILD}`],
    });
    await use(context);
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  },
  backgroundErrors: async ({ context }, use) => {
    const errors: string[] = [];
    context.on('weberror', (e) => errors.push(`weberror: ${e.error().message}`));
    await use(errors);
  },
  background: async ({ context, backgroundErrors }, use) => {
    const [existing] = context.serviceWorkers();
    const worker = existing ?? (await context.waitForEvent('serviceworker'));
    worker.on('console', (m) => {
      if (m.type() === 'error') backgroundErrors.push(`background: ${m.text()}`);
    });
    await use(worker);
  },
  extensionId: async ({ background }, use) => {
    await use(new URL(background.url()).host);
  },
  openSurface: async ({ context, background, extensionId }, use) => {
    const surfaces: Surface[] = [];
    await use(async (path = '/') => {
      // A persistent context starts with one blank tab in its own window: that tab becomes the
      // extension page. The site opens in a second window, where it stays the active tab.
      const ext = context.pages()[0] ?? (await context.newPage());
      const sitePage = context.waitForEvent('page', (p) => p.url().startsWith(SITE));
      const windowId = await background.evaluate(
        async (url) => (await chrome.windows.create({ url, focused: true })).id as number,
        `${SITE}${path}`,
      );
      const site = await sitePage;
      await site.waitForLoadState('load');

      const extUrl = `chrome-extension://${extensionId}/index.html`;
      const pageErrors: Error[] = [];
      ext.on('pageerror', (err) => pageErrors.push(err));
      await ext.addInitScript((id) => {
        const win = chrome.windows;
        const real = win.getCurrent.bind(win);
        Object.defineProperty(win, 'getCurrent', {
          configurable: true,
          value: async (...args: unknown[]) => ({ ...(await (real as (...a: unknown[]) => Promise<chrome.windows.Window>)(...args)), id }),
        });
      }, windowId);
      await ext.goto(extUrl);
      // If the override stopped applying, the background would fall back to the last-focused
      // window - the site window - and most scans would still pass for the wrong reason.
      expect(await ext.evaluate(async () => (await chrome.windows.getCurrent()).id)).toBe(windowId);
      const surface = { ext, site, windowId, pageErrors };
      surfaces.push(surface);
      return surface;
    });
    // Every test, not only the ones that look: an uncaught error in the extension page fails it.
    for (const s of surfaces) expect(s.pageErrors.map((e) => e.message)).toEqual([]);
  },
});

export { expect };

/** Scans from the landing view and waits for the results tabs. */
export async function scanFromLanding(ext: Page): Promise<void> {
  await ext.getByRole('button', { name: 'Scan this page' }).click();
  await expect(ext.getByRole('tablist')).toBeVisible();
}

/** Points the active tab of `windowId` at a URL from the background (pages Playwright cannot open). */
export async function setActiveTabUrl(background: Worker, windowId: number, url: string): Promise<void> {
  await background.evaluate(
    async ({ id, to }) => {
      const [tab] = await chrome.tabs.query({ active: true, windowId: id });
      if (tab?.id == null) throw new Error(`no active tab in window ${id}`);
      await chrome.tabs.update(tab.id, { url: to });
    },
    { id: windowId, to: url },
  );
  await expect
    .poll(() => background.evaluate(async (id) => (await chrome.tabs.query({ active: true, windowId: id }))[0]?.url, windowId))
    .toContain(url.replace(/\/$/, ''));
}

/** Selects one of the six result tabs by its visible label. */
export async function openTab(ext: Page, label: string): Promise<void> {
  const tab = ext.getByRole('tab', { name: label, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

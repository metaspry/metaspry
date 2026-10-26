import type { Locator } from '@playwright/test';
import { test, expect, scanFromLanding, openTab, setActiveTabUrl } from './fixtures';

// UX review 2026-10-25, Mediums 14 and 15: measured on the built extension, not on class names.

/** WCAG contrast of an element's text against its first opaque background. */
async function textContrast(el: Locator): Promise<number> {
  return el.evaluate((node) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const ch = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(r!) + 0.7152 * ch(g!) + 0.0722 * ch(b!);
    };
    const fg = parse(getComputedStyle(node).color);
    let bgEl: Element | null = node;
    let bg = [255, 255, 255];
    while (bgEl) {
      const c = parse(getComputedStyle(bgEl).backgroundColor);
      if (c.length >= 3 && (c.length === 3 || c[3]! >= 0.95)) {
        bg = c.slice(0, 3);
        break;
      }
      bgEl = bgEl.parentElement;
    }
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a! + 0.05) / (b! + 0.05);
  });
}

test('the selected tab has a non-colour cue the others lack', async ({ openSurface }) => {
  const { ext } = await openSurface('/');
  await scanFromLanding(ext);
  const shadow = (name: string) =>
    ext.getByRole('tab', { name, exact: true }).evaluate((el) => getComputedStyle(el).boxShadow);
  expect(await shadow('Tags')).toContain('inset');
  expect(await shadow('Audit')).not.toContain('inset');
  await openTab(ext, 'Audit');
  expect(await shadow('Audit')).toContain('inset');
});

test('messaging preview text is readable (>= 4.5:1)', async ({ openSurface }) => {
  const { ext } = await openSurface('/');
  await scanFromLanding(ext);
  await openTab(ext, 'Previews');
  const bubble = ext.getByRole('region', { name: 'Messaging preview (iMessage / WhatsApp)' });
  for (const p of await bubble.locator('p').all()) expect(await textContrast(p)).toBeGreaterThanOrEqual(4.5);
});

test('the length bar minimum marker is solid slate, not 20 % black', async ({ openSurface }) => {
  const { ext } = await openSurface('/');
  await scanFromLanding(ext);
  await openTab(ext, 'Audit');
  const marker = ext.getByRole('tabpanel').locator('[data-min-marker]').first();
  await expect(marker).toBeAttached();
  expect(await marker.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(51, 65, 85)');
});

test('links inside sentences are underlined, not told apart by colour alone', async ({ openSurface, background }) => {
  const { ext, windowId } = await openSurface('/');
  await setActiveTabUrl(background, windowId, 'chrome://version/');
  await ext.getByRole('button', { name: 'Scan this page' }).click();
  for (const name of ['metaspry.com/docs', 'Report a bug']) {
    const link = ext.getByRole('link', { name });
    expect(await link.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain('underline');
    expect(await textContrast(link)).toBeGreaterThanOrEqual(4.5);
  }
});

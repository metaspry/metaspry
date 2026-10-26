import { test, expect, scanFromLanding, openTab } from './fixtures';
import { RESULT_TABS } from '../src/lib/tabs/registry';

// UX review 2026-10-25, Low items, checked across every results tab of the built extension.

test('every SVG is either hidden from assistive tech or named (Low 28)', async ({ openSurface }) => {
  const { ext } = await openSurface('/');
  await scanFromLanding(ext);
  const offenders: string[] = [];
  for (const t of RESULT_TABS) {
    await openTab(ext, t.label);
    const found = await ext.evaluate(() =>
      Array.from(document.querySelectorAll('svg'))
        .filter((s) => s.getClientRects().length > 0)
        .filter((s) => !s.closest('[aria-hidden="true"]') && !(s.getAttribute('role') === 'img' && s.getAttribute('aria-label')))
        .map((s) => (s.parentElement?.outerHTML ?? '').slice(0, 120)),
    );
    offenders.push(...found.map((f) => `${t.id}: ${f}`));
  }
  expect([...new Set(offenders)]).toEqual([]);
});

test('each results panel starts a section with its own heading (Low 27)', async ({ openSurface }) => {
  const { ext } = await openSurface('/');
  await scanFromLanding(ext);
  for (const t of RESULT_TABS) {
    await openTab(ext, t.label);
    await expect(ext.getByRole('tabpanel').getByRole('heading', { level: 2, name: t.label })).toBeAttached();
  }
});

test('a refused clipboard says the copy failed (Low 31)', async ({ openSurface }) => {
  const { ext } = await openSurface('/');
  await ext.evaluate(() => {
    navigator.clipboard.writeText = async () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await scanFromLanding(ext);
  await ext.getByRole('button', { name: 'Copy og:title value' }).click();
  await expect(ext.getByRole('alert').filter({ hasText: "Couldn't copy og:title" })).toBeVisible();
});

test('disclosure toggles are 24 px and report their state (Low 29)', async ({ openSurface }) => {
  const { ext } = await openSurface('/');
  await scanFromLanding(ext);
  await openTab(ext, 'Site');
  const toggle = ext.getByRole('tabpanel').getByRole('button', { name: 'Show raw' }).first();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  await toggle.click();
  await expect(ext.getByRole('tabpanel').getByRole('button', { name: 'Hide raw' }).first()).toHaveAttribute('aria-expanded', 'true');
});

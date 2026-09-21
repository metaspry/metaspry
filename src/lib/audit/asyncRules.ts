import type { PageMeta } from '../scrapers/PageMeta';
import type { AuditResult, RuleResult } from './AuditResult';
import { rescoreAfterAsync } from './rules';
import type { Settings } from '../storage/settings';
import { DEFAULT_SETTINGS } from '../storage/settings';
import { applyHeaderRobots } from '../scrapers/getRobots';
import { fetchHeaderRobots } from '../scrapers/getHeaderRobots';

interface Dim {
  width: number;
  height: number;
}

function loadImage(src: string, timeoutMs: number): Promise<Dim | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (val: Dim | null) => {
      if (done) return;
      done = true;
      resolve(val);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      finish({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  });
}

function evalDim(dim: Dim | null): { status: 'pass' | 'warn' | 'fail'; detail: string } {
  if (!dim) return { status: 'warn', detail: 'Could not load image to measure.' };
  const { width, height } = dim;
  if (width >= 1200 && height >= 630) {
    return { status: 'pass', detail: `${width}×${height} ≥ 1200×630.` };
  }
  if (width >= 600 && height >= 315) {
    return { status: 'warn', detail: `${width}×${height} — recommend ≥1200×630.` };
  }
  return { status: 'fail', detail: `${width}×${height} — well below 1200×630.` };
}

/**
 * Does this result still need the network?
 *
 * `hasPending` alone was the wrong question: only the og:image-dimensions rule ever produces
 * `pending`, so a page with no og:image skipped `resolveAsyncRules` entirely — and with it the
 * X-Robots-Tag check. A bare staging site with no Open Graph tags is exactly the shape of page that
 * gets de-indexed by header, so the headline fix never ran where it mattered most.
 */
export function needsAsyncResolution(result: AuditResult, meta: PageMeta): boolean {
  if (result.hasPending) return true;
  if (!meta.pageUrl || meta.robots.noindex) return false;
  const noindex = result.rules.find((r) => r.id === 'noindex');
  return !!noindex && noindex.status !== 'fail';
}

export async function resolveAsyncRules(
  initial: AuditResult,
  meta: PageMeta,
  settings: Settings = DEFAULT_SETTINGS
): Promise<AuditResult> {
  const rules: RuleResult[] = [...initial.rules];
  const ogImage = meta.tags.find((t) => t.key.toLowerCase() === 'og:image');
  const idx = rules.findIndex((r) => r.id === 'og:image-dimensions');
  if (idx >= 0 && ogImage) {
    const dim = await loadImage(ogImage.value, 5000);
    const { status, detail } = evalDim(dim);
    const existing = rules[idx];
    if (existing) {
      rules[idx] = {
        id: existing.id,
        severity: existing.severity,
        title: existing.title,
        description: existing.description,
        status,
        detail,
        ...(existing.meta ? { meta: existing.meta } : {}),
      };
    }
  }
  await applyHeaderRobotsRule(rules, meta);

  return rescoreAfterAsync(rules, settings);
}

/**
 * `X-Robots-Tag` is the standard header-only way to de-index a page, and the scraped DOM cannot see
 * it. Fetch it here and, when it de-indexes the page, fail the `noindex` rule the DOM passed.
 * Best-effort: a failed or blocked request leaves the DOM's verdict exactly as it was.
 */
async function applyHeaderRobotsRule(rules: RuleResult[], meta: PageMeta): Promise<void> {
  const idx = rules.findIndex((r) => r.id === 'noindex');
  const existing = idx >= 0 ? rules[idx] : undefined;
  // Already failing on a meta tag, or no URL to ask about: nothing a header could add.
  if (!existing || existing.status === 'fail' || !meta.pageUrl || meta.robots.noindex) return;

  const header = await fetchHeaderRobots(meta.pageUrl);
  if (!header) return;
  const merged = applyHeaderRobots(meta.robots, header);
  // Write the merged result back onto the scraped model, deliberately: the exported JSON and the
  // Site view read `meta.robots`, and leaving them saying `noindex: false, header: null` next to a
  // failing noindex rule is the product contradicting itself.
  meta.robots = merged;
  if (!merged.noindex) return;

  rules[idx] = {
    id: existing.id,
    severity: existing.severity,
    title: existing.title,
    description: existing.description,
    status: 'fail',
    detail: `X-Robots-Tag: ${header} blocks indexing (HTTP header, not in the HTML).`,
    ...(existing.meta ? { meta: existing.meta } : {}),
  };
}

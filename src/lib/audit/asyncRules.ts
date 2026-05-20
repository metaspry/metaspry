import type { PageMeta } from '../scrapers/PageMeta';
import type { AuditResult, RuleResult } from './AuditResult';
import { rescoreAfterAsync } from './rules';
import type { Settings } from '../storage/settings';
import { DEFAULT_SETTINGS } from '../storage/settings';

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
  return rescoreAfterAsync(rules, settings);
}

import type { PageMeta } from '../../scrapers/PageMeta';

export type DiffStatus = 'same' | 'different' | 'left-only' | 'right-only';

/**
 * The status as words (UX review item 3): rows were told apart by a background tint alone,
 * 1.01:1 between "same" and "different", and not at all for a screen reader.
 */
export const DIFF_LABEL: Record<DiffStatus, string> = {
  same: 'Same',
  different: 'Different',
  'left-only': 'Only on current',
  'right-only': 'Only on compared',
};

/** How many rows differ in any way (everything but `same`). */
export function differenceCount(rows: readonly { status: DiffStatus }[]): number {
  return rows.filter((r) => r.status !== 'same').length;
}

export interface DiffRow {
  key: string;
  left: string | null;
  right: string | null;
  status: DiffStatus;
}

function mapByKey(meta: PageMeta): Map<string, string> {
  const map = new Map<string, string>();
  if (meta.title) map.set('title', meta.title);
  if (meta.canonical) map.set('canonical', meta.canonical);
  for (const t of meta.tags) {
    const k = t.key.toLowerCase();
    if (!map.has(k)) map.set(k, t.value);
  }
  return map;
}

const PRIORITY = [
  'title',
  'description',
  'canonical',
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'og:type',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
];

export function diffMeta(a: PageMeta, b: PageMeta): DiffRow[] {
  const aMap = mapByKey(a);
  const bMap = mapByKey(b);
  const keys = new Set<string>([...aMap.keys(), ...bMap.keys()]);

  const rows: DiffRow[] = [];
  for (const key of keys) {
    const left = aMap.get(key) ?? null;
    const right = bMap.get(key) ?? null;
    let status: DiffStatus;
    if (left !== null && right !== null) status = left === right ? 'same' : 'different';
    else if (left !== null) status = 'left-only';
    else status = 'right-only';
    rows.push({ key, left, right, status });
  }

  return rows.sort((x, y) => {
    const xp = PRIORITY.indexOf(x.key);
    const yp = PRIORITY.indexOf(y.key);
    if (xp >= 0 && yp >= 0) return xp - yp;
    if (xp >= 0) return -1;
    if (yp >= 0) return 1;
    return x.key.localeCompare(y.key);
  });
}

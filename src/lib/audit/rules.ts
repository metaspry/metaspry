import type { MetaTag, PageMeta } from '../scrapers/PageMeta';
import type {
  AuditResult,
  RuleResult,
  RuleSeverity,
  RuleStatus,
  ScoreBand,
} from './AuditResult';
import type { Settings } from '../storage/settings';
import { DEFAULT_SETTINGS } from '../storage/settings';

interface RuleDefinition {
  id: string;
  severity: RuleSeverity;
  title: string;
  description: string;
  check: (meta: PageMeta, settings: Settings) => Omit<RuleResult, 'id' | 'severity' | 'title' | 'description'>;
}

function first(meta: PageMeta, key: string): MetaTag | undefined {
  const lower = key.toLowerCase();
  return meta.tags.find((t) => t.key.toLowerCase() === lower);
}

function all(meta: PageMeta, key: string): MetaTag[] {
  const lower = key.toLowerCase();
  return meta.tags.filter((t) => t.key.toLowerCase() === lower);
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function lenRule(
  length: number,
  min: number,
  max: number,
  label: string
): Omit<RuleResult, 'id' | 'severity' | 'title' | 'description'> {
  if (length < min) {
    return { status: 'warn', detail: `${length} chars — too short (aim ${min}–${max}).`, meta: { length, min, max } };
  }
  if (length > max) {
    return { status: 'warn', detail: `${length} chars — too long (aim ${min}–${max}).`, meta: { length, min, max } };
  }
  return { status: 'pass', detail: `${length} chars — within ${min}–${max}.`, meta: { length, min, max } };
}

const RULES: RuleDefinition[] = [
  {
    id: 'title',
    severity: 'required',
    title: 'Page title',
    description: '<title> tag must be present.',
    check: (m) => (m.title ? { status: 'pass', detail: `"${m.title}"` } : { status: 'fail', detail: 'No <title> tag found.' }),
  },
  {
    id: 'description',
    severity: 'required',
    title: 'Meta description',
    description: 'meta[name="description"] must be present.',
    check: (m) => {
      const t = first(m, 'description');
      return t ? { status: 'pass', detail: `${t.value.length} chars` } : { status: 'fail', detail: 'No description meta tag.' };
    },
  },
  {
    id: 'og:title',
    severity: 'required',
    title: 'Open Graph title',
    description: 'og:title needed for social shares.',
    check: (m) => {
      const t = first(m, 'og:title');
      return t ? { status: 'pass', detail: `"${t.value}"` } : { status: 'fail', detail: 'og:title missing.' };
    },
  },
  {
    id: 'og:description',
    severity: 'required',
    title: 'Open Graph description',
    description: 'og:description needed for social shares.',
    check: (m) => {
      const t = first(m, 'og:description');
      return t ? { status: 'pass', detail: `${t.value.length} chars` } : { status: 'fail', detail: 'og:description missing.' };
    },
  },
  {
    id: 'og:image',
    severity: 'required',
    title: 'Open Graph image',
    description: 'og:image is the thumbnail used by every major platform.',
    check: (m) => {
      const t = first(m, 'og:image');
      return t ? { status: 'pass', detail: t.value } : { status: 'fail', detail: 'og:image missing.' };
    },
  },
  {
    id: 'noindex',
    severity: 'required',
    title: 'Indexable by search engines',
    description: 'Page must not be marked noindex.',
    check: (m) => {
      if (m.robots.noindex) {
        return { status: 'fail', detail: `Robots: ${m.robots.robots ?? m.robots.googlebot ?? 'noindex'} blocks indexing.` };
      }
      return { status: 'pass', detail: m.robots.robots ? `robots: ${m.robots.robots}` : 'No noindex directive.' };
    },
  },
  {
    id: 'og:url',
    severity: 'recommended',
    title: 'Open Graph URL',
    description: 'og:url anchors the canonical share URL.',
    check: (m) => {
      const t = first(m, 'og:url');
      return t ? { status: 'pass', detail: t.value } : { status: 'warn', detail: 'og:url missing.' };
    },
  },
  {
    id: 'og:type',
    severity: 'recommended',
    title: 'Open Graph type',
    description: 'og:type (e.g. "website", "article").',
    check: (m) => {
      const t = first(m, 'og:type');
      return t ? { status: 'pass', detail: t.value } : { status: 'warn', detail: 'og:type missing.' };
    },
  },
  {
    id: 'twitter:card',
    severity: 'recommended',
    title: 'Twitter card type',
    description: 'twitter:card controls the Twitter preview layout.',
    check: (m) => {
      const t = first(m, 'twitter:card');
      return t ? { status: 'pass', detail: t.value } : { status: 'warn', detail: 'twitter:card missing.' };
    },
  },
  {
    id: 'canonical',
    severity: 'recommended',
    title: 'Canonical URL',
    description: '<link rel="canonical"> prevents duplicate-content issues.',
    check: (m) => (m.canonical ? { status: 'pass', detail: m.canonical } : { status: 'warn', detail: 'No canonical link.' }),
  },
  {
    id: 'article-og',
    severity: 'recommended',
    title: 'Article OG metadata',
    description: 'When og:type=article, fill article:author, article:published_time, article:section.',
    check: (m) => {
      const type = first(m, 'og:type')?.value.toLowerCase();
      if (type !== 'article') return { status: 'pass', detail: 'Not an article page; skipped.' };
      const missing = ['article:author', 'article:published_time', 'article:section'].filter((k) => !first(m, k));
      if (missing.length === 0) return { status: 'pass', detail: 'All article tags present.' };
      return { status: 'warn', detail: `Missing: ${missing.join(', ')}` };
    },
  },
  {
    id: 'hreflang-self',
    severity: 'recommended',
    title: 'hreflang self-reference',
    description: 'When hreflang links exist, one should reference this page.',
    check: (m) => {
      if (m.hreflang.length === 0) return { status: 'pass', detail: 'No hreflang links; skipped.' };
      const here = m.canonical ?? document.location.href;
      const hasSelf = m.hreflang.some((h) => {
        try {
          return new URL(h.href).toString() === new URL(here).toString();
        } catch {
          return false;
        }
      });
      return hasSelf
        ? { status: 'pass', detail: `${m.hreflang.length} alternates; self-reference present.` }
        : { status: 'warn', detail: `${m.hreflang.length} alternates; no self-reference link.` };
    },
  },
  {
    id: 'title-length',
    severity: 'best-practice',
    title: 'Title length',
    description: 'Search engines truncate titles outside this range.',
    check: (m, s) => {
      if (!m.title) return { status: 'fail', detail: 'No title to measure.' };
      return lenRule(m.title.length, s.titleMin, s.titleMax, 'title');
    },
  },
  {
    id: 'description-length',
    severity: 'best-practice',
    title: 'Description length',
    description: 'Snippets outside this range get truncated or padded.',
    check: (m, s) => {
      const t = first(m, 'description');
      if (!t) return { status: 'fail', detail: 'No description to measure.' };
      return lenRule(t.value.length, s.descMin, s.descMax, 'description');
    },
  },
  {
    id: 'og-description-length',
    severity: 'best-practice',
    title: 'og:description length',
    description: 'Twitter, Facebook clip og:description aggressively.',
    check: (m, s) => {
      const t = first(m, 'og:description');
      if (!t) return { status: 'fail', detail: 'No og:description to measure.' };
      return lenRule(t.value.length, s.ogDescMin, s.ogDescMax, 'og:description');
    },
  },
  {
    id: 'og:image-absolute',
    severity: 'best-practice',
    title: 'og:image is absolute URL',
    description: 'Relative og:image URLs break on most platforms.',
    check: (m) => {
      const t = first(m, 'og:image');
      if (!t) return { status: 'fail', detail: 'No og:image to check.' };
      return isAbsoluteUrl(t.value)
        ? { status: 'pass', detail: 'Absolute URL' }
        : { status: 'warn', detail: `Not absolute: ${t.value}` };
    },
  },
  {
    id: 'og:image-dimensions',
    severity: 'best-practice',
    title: 'og:image dimensions',
    description: 'Recommend at least 1200×630.',
    check: (m) => {
      const t = first(m, 'og:image');
      if (!t) return { status: 'fail', detail: 'No og:image to check.' };
      return { status: 'pending', detail: 'Checking image dimensions…' };
    },
  },
  {
    id: 'dup-tags',
    severity: 'best-practice',
    title: 'No duplicate meta tags',
    description: 'Repeated identical keys can confuse crawlers.',
    check: (m) => {
      const counts = new Map<string, number>();
      for (const t of m.tags) {
        const k = t.key.toLowerCase();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const dups = Array.from(counts.entries()).filter(([, c]) => c > 1);
      if (dups.length === 0) return { status: 'pass', detail: 'All keys unique.' };
      return { status: 'warn', detail: dups.map(([k, c]) => `${k}×${c}`).join(', ') };
    },
  },
  {
    id: 'jsonld-parse',
    severity: 'best-practice',
    title: 'JSON-LD parses cleanly',
    description: 'Malformed application/ld+json blocks fail.',
    check: (m) => {
      if (m.jsonLd.parseErrors === 0 && m.jsonLd.entities.length === 0) {
        return { status: 'pass', detail: 'No JSON-LD on page.' };
      }
      if (m.jsonLd.parseErrors === 0) {
        return { status: 'pass', detail: `${m.jsonLd.entities.length} entit${m.jsonLd.entities.length === 1 ? 'y' : 'ies'} parsed.` };
      }
      return { status: 'fail', detail: `${m.jsonLd.parseErrors} JSON-LD block(s) failed to parse.` };
    },
  },
];

function scoreFor(status: RuleStatus, severity: RuleSeverity, weights: Settings['weights']): number {
  const w = weights[severity];
  if (status === 'pass') return w;
  if (status === 'warn') return w / 2;
  if (status === 'pending') return w / 2;
  return 0;
}

function band(score: number): ScoreBand {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

export function audit(meta: PageMeta, settings: Settings = DEFAULT_SETTINGS): AuditResult {
  const results: RuleResult[] = RULES.map((rule) => {
    const r = rule.check(meta, settings);
    return {
      id: rule.id,
      severity: rule.severity,
      title: rule.title,
      description: rule.description,
      status: r.status,
      detail: r.detail,
      ...(r.meta ? { meta: r.meta } : {}),
    };
  });

  const earned = results.reduce((sum, r) => sum + scoreFor(r.status, r.severity, settings.weights), 0);
  const possible = RULES.reduce((sum, r) => sum + settings.weights[r.severity], 0);
  const score = Math.round((earned / possible) * 100);

  return {
    score,
    band: band(score),
    rules: results,
    hasPending: results.some((r) => r.status === 'pending'),
  };
}

export function rescoreAfterAsync(rules: RuleResult[], settings: Settings = DEFAULT_SETTINGS): AuditResult {
  const earned = rules.reduce((sum, r) => sum + scoreFor(r.status, r.severity, settings.weights), 0);
  const possible = RULES.reduce((sum, r) => sum + settings.weights[r.severity], 0);
  const score = Math.round((earned / possible) * 100);
  return {
    score,
    band: band(score),
    rules,
    hasPending: rules.some((r) => r.status === 'pending'),
  };
}

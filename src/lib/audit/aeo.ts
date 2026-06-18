// AEO ("AI-era SEO") readiness for the extension. Mirrors the server analyzer
// (app/functions/src/aeo.ts) + its PASS/WARN/INFO/FAIL honesty model, but runs on the
// scraped page DOM + the already-parsed SiteFiles (robots.groups, llms).
//
// Difference from the server: the extension inspects the rendered DOM, so it cannot tell
// raw HTML from JS-rendered. The server's "content in raw HTML / JS-only" check is omitted
// here and surfaced as an INFO note instead.
import type { SiteFiles, RobotsGroup } from '../scrapers/SiteFiles';

export type AeoState = 'pass' | 'warn' | 'info' | 'fail';
export interface AeoCheck {
  id: string;
  label: string;
  state: AeoState;
  detail: string;
  scope: 'page' | 'site';
}
export interface AeoResult {
  checks: AeoCheck[];
  chip: 'ready' | 'needs-work';
}

// Keep aligned with app/functions/src/aeo.ts.
export const AI_BOTS = {
  retrieval: ['OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot', 'Googlebot'],
  training: [
    'GPTBot',
    'ClaudeBot',
    'CCBot',
    'Google-Extended',
    'Applebot-Extended',
    'Bytespider',
    'Meta-ExternalAgent',
  ],
} as const;

/** Is a bot fully blocked in robots.txt? Most-specific user-agent group wins over '*'. */
function isBotBlocked(groups: RobotsGroup[], token: string): boolean {
  const t = token.toLowerCase();
  const specific = groups.find((g) => g.userAgents.map((u) => u.toLowerCase()).includes(t));
  const wildcard = groups.find((g) => g.userAgents.includes('*'));
  const g = specific ?? wildcard;
  if (!g) return false;
  return g.disallow.includes('/') && !g.allow.includes('/');
}

function bodyText(doc: ParentNode): string {
  const body = doc.querySelector('body') ?? doc;
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function analyzeAeo(html: ParentNode, siteFiles: SiteFiles | null, baseUrl: string): AeoResult {
  const checks: AeoCheck[] = [];

  // --- Page-level (rendered DOM) ---
  const metaRobots = (
    html.querySelector('meta[name="robots" i]')?.getAttribute('content') ?? ''
  ).toLowerCase();
  const noindex = /\bnoindex\b/.test(metaRobots);
  const nosnippet = /\bnosnippet\b/.test(metaRobots) || /max-snippet:\s*0/.test(metaRobots);
  checks.push(
    noindex || nosnippet
      ? {
          id: 'aeo-indexable',
          label: 'Indexable & snippet-eligible',
          state: 'warn',
          detail: `Page sets ${noindex ? 'noindex' : 'nosnippet'} - AI search features need indexable, snippet-eligible pages.`,
          scope: 'page',
        }
      : {
          id: 'aeo-indexable',
          label: 'Indexable & snippet-eligible',
          state: 'pass',
          detail: 'No noindex/nosnippet directive.',
          scope: 'page',
        },
  );

  const h1s = html.querySelectorAll('h1').length;
  const h2s = html.querySelectorAll('h2').length;
  const headings = Array.from(html.querySelectorAll('h1,h2,h3')).map((h) =>
    (h.textContent ?? '').trim().toLowerCase(),
  );
  const hasQuestionHeading = headings.some(
    (h) => h.includes('?') || /^(how|what|why|when|where|who|which|can|do|is|are)\b/.test(h),
  );
  checks.push(
    h1s === 1
      ? {
          id: 'aeo-headings',
          label: 'Heading structure',
          state: hasQuestionHeading ? 'pass' : 'info',
          detail: hasQuestionHeading
            ? 'Single H1 with question-style headings (answer-first content suits AI retrieval).'
            : `Single H1, ${h2s} H2. Tip: question-style headings + short direct answers help AI passage retrieval.`,
          scope: 'page',
        }
      : {
          id: 'aeo-headings',
          label: 'Heading structure',
          state: 'warn',
          detail: `${h1s} H1 tags - use exactly one H1 and a logical H2/H3 hierarchy.`,
          scope: 'page',
        },
  );

  const text = bodyText(html);
  const hasStats = /\d/.test(text) && /(%|\d[\d,.]{2,})/.test(text);
  const hasQuotes = /["""]/.test(text);
  let host = '';
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    /* ignore */
  }
  const outbound = Array.from(html.querySelectorAll('a[href^="http"]')).some((a) => {
    try {
      return new URL(a.getAttribute('href') ?? '').hostname !== host;
    } catch {
      return false;
    }
  });
  const leverCount = [hasStats, hasQuotes, outbound].filter(Boolean).length;
  checks.push({
    id: 'aeo-geo-levers',
    label: 'Citation levers (stats / quotes / sources)',
    state: 'info',
    detail: `${leverCount}/3 present (statistics, quotations, outbound citations) - linked to higher AI-answer inclusion.`,
    scope: 'page',
  });

  const ldNodes = Array.from(html.querySelectorAll('script[type="application/ld+json"]'));
  let ldValid = 0;
  let ldText = '';
  for (const n of ldNodes) {
    try {
      JSON.parse(n.textContent ?? '');
      ldValid++;
      ldText += (n.textContent ?? '').toLowerCase();
    } catch {
      /* invalid block */
    }
  }
  checks.push(
    ldValid > 0
      ? {
          id: 'aeo-jsonld',
          label: 'Structured data (JSON-LD)',
          state: 'pass',
          detail: `${ldValid} valid JSON-LD block(s) - improves machine readability for AI parsers.`,
          scope: 'page',
        }
      : {
          id: 'aeo-jsonld',
          label: 'Structured data (JSON-LD)',
          state: 'info',
          detail: 'No JSON-LD. Not required for AI features, but it helps machines disambiguate your content.',
          scope: 'page',
        },
  );

  const hasAuthor =
    !!html.querySelector('meta[name="author" i]') ||
    /"author"/.test(ldText) ||
    /"@type"\s*:\s*"person"/.test(ldText);
  const hasDate =
    !!html.querySelector('time[datetime]') ||
    /datepublished|datemodified/.test(ldText) ||
    !!html.querySelector('meta[property="article:published_time" i]');
  checks.push(
    hasAuthor && hasDate
      ? {
          id: 'aeo-author-date',
          label: 'Author & freshness',
          state: 'pass',
          detail: 'Author and date metadata present (AI engines favour attributable, fresh content).',
          scope: 'page',
        }
      : {
          id: 'aeo-author-date',
          label: 'Author & freshness',
          state: 'warn',
          detail: `Missing ${!hasAuthor ? 'author' : ''}${!hasAuthor && !hasDate ? ' and ' : ''}${!hasDate ? 'date' : ''} metadata - attribution and freshness correlate with AI citations.`,
          scope: 'page',
        },
  );

  // --- Site-level (already-parsed SiteFiles) ---
  if (siteFiles?.robots.present) {
    const groups = siteFiles.robots.groups;
    const blockedRetrieval = AI_BOTS.retrieval.filter((b) => isBotBlocked(groups, b));
    checks.push(
      blockedRetrieval.length
        ? {
            id: 'aeo-ai-retrieval',
            label: 'AI search/retrieval crawlers allowed',
            state: 'warn',
            detail: `robots.txt blocks ${blockedRetrieval.join(', ')} - these power AI answers, so blocking them removes you from those surfaces.`,
            scope: 'site',
          }
        : {
            id: 'aeo-ai-retrieval',
            label: 'AI search/retrieval crawlers allowed',
            state: 'pass',
            detail: 'AI search/retrieval crawlers (OAI-SearchBot, PerplexityBot, Googlebot, …) are not blocked.',
            scope: 'site',
          },
    );

    const blockedTraining = AI_BOTS.training.filter((b) => isBotBlocked(groups, b));
    checks.push({
      id: 'aeo-ai-training',
      label: 'AI training crawlers',
      state: 'info',
      detail: blockedTraining.length
        ? `Blocking ${blockedTraining.join(', ')} - a training opt-out (licensing choice). Does NOT affect AI search visibility.`
        : 'No AI training crawlers blocked. (Blocking them would be a licensing choice, not a visibility issue.)',
      scope: 'site',
    });
  }

  if (siteFiles?.llms) {
    const present = siteFiles.llms.present;
    const raw = siteFiles.llms.raw ?? '';
    const hasH1 = /^#\s+\S/m.test(raw);
    const hasSection = /^##\s+\S/m.test(raw);
    checks.push({
      id: 'aeo-llms-txt',
      label: 'llms.txt',
      state: 'info',
      detail: present
        ? `Present${hasH1 && hasSection ? ' and well-formed' : ' (incomplete structure)'}. Note: no major AI provider is confirmed to consume llms.txt yet.`
        : 'No /llms.txt. Optional emerging convention - low confirmed impact today.',
      scope: 'site',
    });
  }

  // The server's raw-HTML / JS-only check can't run on a rendered DOM - surface as INFO.
  checks.push({
    id: 'aeo-raw-html',
    label: 'Content in raw HTML',
    state: 'info',
    detail: 'AI crawlers read the raw HTML and do not run JavaScript. Run a cloud scan to check whether your content is in the raw HTML (not JS-only).',
    scope: 'page',
  });

  const needsWork = checks.some((c) => c.state === 'fail' || c.state === 'warn');
  return { checks, chip: needsWork ? 'needs-work' : 'ready' };
}

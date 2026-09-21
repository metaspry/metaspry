import type {
  LlmsInfo,
  LlmsSection,
  RobotsGroup,
  RobotsInfo,
  SiteFiles,
  SitemapChild,
  SitemapInfo,
} from './SiteFiles';

const TIMEOUT_MS = 4000;
const MAX_BODY = 2_000_000;
const MAX_CHILDREN = 20;
const MAX_RECURSION_DEPTH = 2;
/**
 * Total sitemap fetches one scan may make. A nested index of 20 children, each an index of 20,
 * fired ~420 requests inline before the scan could upload - in popup mode the popup closes first
 * and the scan never syncs at all.
 */
const MAX_SITEMAP_FETCHES = 40;
/** How many of those run at once. Promise.all over every child opened them all simultaneously. */
const SITEMAP_CONCURRENCY = 6;

/** Marker for a child the budget stopped us reading, so the caller can flag the total. */
export const BUDGET_ERROR = 'Not read - sitemap fetch budget reached.';

/** Fetch budget for one `fetchSiteFiles` call. */
interface Budget {
  left: number;
}

/** Run tasks with a concurrency cap, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface FetchedDoc {
  ok: boolean;
  text: string;
  contentType: string;
  status: number;
  /** The body hit MAX_BODY and was cut, so any XML in it is incomplete. */
  cut?: boolean;
  error?: string;
}

async function fetchText(url: string): Promise<FetchedDoc> {
  const res = await fetchWithTimeout(url);
  if (!res) return { ok: false, text: '', contentType: '', status: 0, error: 'Request failed or timed out.' };
  if (!res.ok) return { ok: false, text: '', contentType: res.headers.get('content-type') ?? '', status: res.status, error: `HTTP ${res.status}` };
  const text = await res.text();
  const cut = text.length > MAX_BODY;
  return {
    ok: true,
    text: cut ? text.slice(0, MAX_BODY) : text,
    contentType: res.headers.get('content-type') ?? '',
    status: res.status,
    ...(cut ? { cut: true } : {}),
  };
}

function looksLikeHtml(text: string, contentType: string): boolean {
  const head = text.slice(0, 200).trimStart().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return true;
  const ct = contentType.toLowerCase();
  return ct.includes('text/html') || ct.includes('application/xhtml');
}

/**
 * Plenty of servers send a perfectly good robots.txt as `text/html`. Declaring it missing on the
 * content type alone reported "no robots.txt" for a site that has one - and silently dropped both
 * AI-crawler checks with it. Content wins over the header.
 */
function looksLikeRobots(text: string): boolean {
  return /^\s*(user-agent|sitemap|allow|disallow)\s*:/im.test(text);
}

function resolvePath(baseUrl: string, path: string): string | null {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseRobots(raw: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const lines = raw.split(/\r?\n/);
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let expectingAgents = true;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const directive = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!value) continue;

    if (directive === 'sitemap') {
      sitemaps.push(value);
      continue;
    }

    if (directive === 'user-agent') {
      if (!current || !expectingAgents) {
        current = { userAgents: [], disallow: [], allow: [] };
        groups.push(current);
        expectingAgents = true;
      }
      current.userAgents.push(value);
      continue;
    }

    if (current && (directive === 'allow' || directive === 'disallow' || directive === 'crawl-delay')) {
      expectingAgents = false;
      if (directive === 'allow') current.allow.push(value);
      else if (directive === 'disallow') current.disallow.push(value);
    }
  }

  return { groups, sitemaps };
}

interface ParsedSitemap {
  isIndex: boolean;
  locs: string[];
}

function parseSitemapXml(raw: string): ParsedSitemap | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(trimmed, 'application/xml');
  } catch {
    return null;
  }
  if (doc.querySelector('parsererror')) return null;
  const isIndex = !!doc.querySelector('sitemapindex');
  const hasUrlset = !!doc.querySelector('urlset');
  if (!isIndex && !hasUrlset) return null;
  const locs = Array.from(doc.querySelectorAll('loc'))
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean);
  return { isIndex, locs };
}

async function tryParseSitemap(
  url: string
): Promise<{ ok: true; parsed: ParsedSitemap } | { ok: false; error: string; tooLarge?: boolean }> {
  const fetched = await fetchText(url);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error ?? 'Fetch failed.' };
  }
  if (looksLikeHtml(fetched.text, fetched.contentType)) {
    return { ok: false, error: 'Server returned HTML (likely SPA fallback or missing route).' };
  }
  const parsed = parseSitemapXml(fetched.text);
  if (!parsed) {
    // A sitemap over MAX_BODY was cut mid-XML and then reported as invalid, so large sites were
    // told their perfectly good sitemap was broken. Say what actually happened.
    if (fetched.cut) {
      return {
        ok: false,
        tooLarge: true,
        error: `Sitemap is larger than ${Math.round(MAX_BODY / 1_000_000)} MB - too big to read here. It is probably fine; check it in the web app.`,
      };
    }
    return { ok: false, error: 'Response was not a valid sitemap XML.' };
  }
  return { ok: true, parsed };
}

async function resolveSitemap(url: string, depth: number, budget: Budget): Promise<SitemapChild> {
  if (budget.left <= 0) {
    return { url, urlCount: 0, isIndex: false, error: BUDGET_ERROR };
  }
  budget.left -= 1;
  const res = await tryParseSitemap(url);
  if (!res.ok) {
    return { url, urlCount: 0, isIndex: false, error: res.error };
  }
  const { parsed } = res;
  if (!parsed.isIndex || depth >= MAX_RECURSION_DEPTH) {
    return { url, urlCount: parsed.locs.length, isIndex: parsed.isIndex };
  }
  const childLocs = parsed.locs.slice(0, MAX_CHILDREN);
  const children = await mapLimit(childLocs, SITEMAP_CONCURRENCY, (loc) =>
    resolveSitemap(loc, depth + 1, budget)
  );
  const total = children.reduce((sum, c) => sum + c.urlCount, 0);
  return { url, urlCount: total, isIndex: true };
}

function emptySitemap(error?: string): SitemapInfo {
  return {
    present: false,
    isIndex: false,
    urlCount: 0,
    childCount: 0,
    children: [],
    sample: [],
    truncated: false,
    ...(error ? { error } : {}),
  };
}

async function buildSitemapFromParsed(_sourceUrl: string, parsed: ParsedSitemap): Promise<SitemapInfo> {
  if (!parsed.isIndex) {
    return {
      present: true,
      isIndex: false,
      urlCount: parsed.locs.length,
      childCount: 0,
      children: [],
      sample: parsed.locs.slice(0, 10),
      truncated: false,
    };
  }
  const allChildLocs = parsed.locs;
  const truncated = allChildLocs.length > MAX_CHILDREN;
  const childLocs = allChildLocs.slice(0, MAX_CHILDREN);
  const budget: Budget = { left: MAX_SITEMAP_FETCHES };
  const children = await mapLimit(childLocs, SITEMAP_CONCURRENCY, (loc) =>
    resolveSitemap(loc, 1, budget)
  );
  const total = children.reduce((sum, c) => sum + c.urlCount, 0);
  // Children we could not read contribute 0, so the total is a floor, not a count. Say so rather
  // than presenting a number partly built from unread files.
  const budgetExhausted = children.some((c) => c.error === BUDGET_ERROR);
  return {
    present: true,
    isIndex: true,
    urlCount: total,
    ...(budgetExhausted ? { budgetExhausted: true } : {}),
    childCount: allChildLocs.length,
    children,
    sample: allChildLocs.slice(0, 10),
    truncated,
  };
}

const COMMON_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/wp-sitemap.xml',
  '/sitemaps.xml',
  '/sitemap/sitemap.xml',
  '/sitemaps/sitemap.xml',
];

async function buildSitemap(baseUrl: string, robotsSitemaps: string[]): Promise<SitemapInfo> {
  const candidates: string[] = [];
  // 1. URLs declared in robots.txt — highest priority signal
  for (const u of robotsSitemaps) {
    const resolved = resolvePath(baseUrl, u);
    if (resolved && !candidates.includes(resolved)) candidates.push(resolved);
  }
  // 2. Common well-known paths
  for (const path of COMMON_SITEMAP_PATHS) {
    const resolved = resolvePath(baseUrl, path);
    if (resolved && !candidates.includes(resolved)) candidates.push(resolved);
  }
  if (candidates.length === 0) return emptySitemap('Invalid base URL.');

  let lastError = 'No sitemap found at known locations.';
  for (const candidate of candidates) {
    const res = await tryParseSitemap(candidate);
    if (res.ok) {
      const built = await buildSitemapFromParsed(candidate, res.parsed);
      if (candidate === candidates[0]) return built;
      return { ...built, error: `Found at fallback location: ${candidate}` };
    }
    // A sitemap that EXISTS but is too big to read is not a missing sitemap. Stop here and say so:
    // otherwise this error was overwritten by the 404 from the next fallback path, and the card
    // showed a red "Missing" badge for a site whose sitemap.xml is perfectly valid.
    if (res.tooLarge) {
      return { ...emptySitemap(res.error), present: true };
    }
    lastError = `${candidate}: ${res.error}`;
  }
  return emptySitemap(`Tried ${candidates.length} location(s). Last error — ${lastError}`);
}

function parseLlms(raw: string, baseUrl: string): LlmsSection[] {
  const lines = raw.split(/\r?\n/);
  const sections: LlmsSection[] = [];
  let current: LlmsSection | null = null;

  for (const rawLine of lines) {
    const heading = rawLine.match(/^#{1,3}\s+(.+?)\s*$/);
    if (heading && heading[1]) {
      current = { heading: heading[1], links: [] };
      sections.push(current);
      continue;
    }
    const link = rawLine.match(/^\s*-\s*\[([^\]]+)\]\(([^)]+)\)/);
    if (link && current && link[1] && link[2]) {
      // Resolve against the site: llms.txt routinely uses relative targets, and safeHref only
      // accepts absolute http(s), so leaving them raw turned every relative link into text.
      current.links.push({ label: link[1], url: resolvePath(baseUrl, link[2]) ?? link[2] });
    }
  }

  if (sections.length === 0) {
    sections.push({ heading: 'Content', links: [] });
  }
  return sections;
}

async function buildRobots(baseUrl: string): Promise<RobotsInfo> {
  const target = resolvePath(baseUrl, '/robots.txt');
  if (!target) {
    return { present: false, raw: null, groups: [], sitemaps: [], error: 'Invalid base URL.' };
  }
  const fetched = await fetchText(target);
  if (!fetched.ok) {
    return { present: false, raw: null, groups: [], sitemaps: [], ...(fetched.error ? { error: fetched.error } : {}) };
  }
  if (looksLikeHtml(fetched.text, fetched.contentType) && !looksLikeRobots(fetched.text)) {
    return { present: false, raw: null, groups: [], sitemaps: [], error: 'Server returned HTML (likely SPA fallback or missing route).' };
  }
  const parsed = parseRobots(fetched.text);
  return {
    present: true,
    raw: fetched.text,
    groups: parsed.groups,
    sitemaps: parsed.sitemaps,
  };
}

async function buildLlms(baseUrl: string): Promise<LlmsInfo> {
  const target = resolvePath(baseUrl, '/llms.txt');
  if (!target) {
    return { present: false, raw: null, sections: [], error: 'Invalid base URL.' };
  }
  const fetched = await fetchText(target);
  if (!fetched.ok) {
    return { present: false, raw: null, sections: [], ...(fetched.error ? { error: fetched.error } : {}) };
  }
  if (looksLikeHtml(fetched.text, fetched.contentType)) {
    return { present: false, raw: null, sections: [], error: 'Server returned HTML (likely SPA fallback or missing route).' };
  }
  return {
    present: true,
    raw: fetched.text,
    sections: parseLlms(fetched.text, target),
  };
}

export async function fetchSiteFiles(baseUrl: string): Promise<SiteFiles> {
  const [robots, llms] = await Promise.all([buildRobots(baseUrl), buildLlms(baseUrl)]);
  const sitemap = await buildSitemap(baseUrl, robots.sitemaps);
  return { robots, sitemap, llms };
}

import { report } from '../diagnostics';
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
/** Marker for an index child on a private or local address (or not http(s)): never requested. */
export const BLOCKED_TARGET_ERROR = 'Not read - private or local address.';
const PRIVATE_REDIRECT_ERROR = 'Redirected to a private network address.';
/**
 * robots.txt `Sitemap:` lines tried before the well-known paths. They were all tried, one after
 * another, so a robots.txt with thousands of lines drove thousands of 4 s fetches (review High 4).
 */
export const MAX_ROBOTS_SITEMAPS = 5;
/** How long the signed-in upload waits for site files before it writes the scan without them. */
export const UPLOAD_SITE_FILES_WAIT_MS = 8000;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function privateIpv4(a: number, b: number): boolean {
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Loopback, private, link-local or CGNAT addresses and local-only names. `hostname` as
 * `URL.hostname` gives it (IPv6 in brackets, IPv4 already normalised from forms like `0x7f.1`).
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || /\.(localhost|local|internal|lan|home\.arpa)$/.test(h)) return true;
  const v4 = h.match(IPV4);
  if (v4) return privateIpv4(Number(v4[1]), Number(v4[2]));
  if (!h.startsWith('[')) return false;
  const v6 = h.slice(1, -1);
  if (v6 === '::1' || v6 === '::') return true;
  if (/^f[cd][0-9a-f]{0,2}:/.test(v6) || /^fe[89ab][0-9a-f]?:/.test(v6)) return true;
  // IPv4-mapped: URL serialises ::ffff:192.168.0.1 as ::ffff:c0a8:1.
  const mappedHex = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1] as string, 16);
    return privateIpv4(hi >> 8, hi & 0xff);
  }
  const mappedDot = v6.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  return !!mappedDot && privateIpv4(Number(mappedDot[1]), Number(mappedDot[2]));
}

/**
 * May a sitemap URL the site declared (robots.txt `Sitemap:`, a sitemap index `<loc>`) be fetched
 * for a page on `pageHost`? http(s) only. Another public host is fine: search engines accept a
 * sitemap on a CDN or bucket when robots.txt declares it. A private, loopback or local address,
 * or a single-label name (`http://intranet/`, which DNS search suffixes can resolve inside the
 * user's network), only when it is the page's own host (a dev server, the e2e fixture site).
 */
function allowedTarget(url: string, pageHost: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname;
  if (host === pageHost) return true;
  const singleLabel = !host.includes('.') && !host.startsWith('[');
  return !singleLabel && !isPrivateHost(host);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

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

async function fetchText(url: string, pageHost: string): Promise<FetchedDoc> {
  const res = await fetchWithTimeout(url);
  if (!res) return { ok: false, text: '', contentType: '', status: 0, error: 'Request failed or timed out.' };
  // fetch follows redirects without showing the hops; the final URL is all there is. A public
  // site redirecting into the user's network gets nothing read, shown or uploaded.
  // The final URL passes the same test as a request would (ultra review 2026-10-26, F2): a single-
  // label host (`http://intranet/`) or a private address other than the page's own was let through.
  const finalHost = hostOf(res.url || url);
  if (finalHost && !allowedTarget(res.url || url, pageHost)) {
    return { ok: false, text: '', contentType: '', status: res.status, error: PRIVATE_REDIRECT_ERROR };
  }
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
  url: string,
  pageHost: string
): Promise<{ ok: true; parsed: ParsedSitemap } | { ok: false; error: string; tooLarge?: boolean }> {
  const fetched = await fetchText(url, pageHost);
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

async function resolveSitemap(url: string, depth: number, budget: Budget, pageHost: string): Promise<SitemapChild> {
  // An index can list any URL; one in the user's network is never requested.
  if (!allowedTarget(url, pageHost)) {
    return { url, urlCount: 0, isIndex: false, error: BLOCKED_TARGET_ERROR };
  }
  if (budget.left <= 0) {
    return { url, urlCount: 0, isIndex: false, error: BUDGET_ERROR };
  }
  budget.left -= 1;
  const res = await tryParseSitemap(url, pageHost);
  if (!res.ok) {
    return { url, urlCount: 0, isIndex: false, error: res.error };
  }
  const { parsed } = res;
  if (!parsed.isIndex || depth >= MAX_RECURSION_DEPTH) {
    return { url, urlCount: parsed.locs.length, isIndex: parsed.isIndex };
  }
  const childLocs = parsed.locs.slice(0, MAX_CHILDREN);
  const children = await mapLimit(childLocs, SITEMAP_CONCURRENCY, (loc) =>
    resolveSitemap(loc, depth + 1, budget, pageHost)
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

async function buildSitemapFromParsed(parsed: ParsedSitemap, pageHost: string): Promise<SitemapInfo> {
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
    resolveSitemap(loc, 1, budget, pageHost)
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
  const pageHost = hostOf(baseUrl);
  const candidates: string[] = [];
  const skipped: string[] = [];
  // 1. URLs declared in robots.txt — highest priority signal. Only the first MAX_ROBOTS_SITEMAPS,
  // and none in the user's network: the file is the scanned site's to write, hostile or not.
  for (const u of robotsSitemaps) {
    if (candidates.length >= MAX_ROBOTS_SITEMAPS) break;
    const resolved = resolvePath(baseUrl, u);
    if (!resolved || candidates.includes(resolved) || skipped.includes(resolved)) continue;
    if (allowedTarget(resolved, pageHost)) candidates.push(resolved);
    else skipped.push(resolved);
  }
  // 2. Common well-known paths
  for (const path of COMMON_SITEMAP_PATHS) {
    const resolved = resolvePath(baseUrl, path);
    if (resolved && !candidates.includes(resolved)) candidates.push(resolved);
  }
  if (candidates.length === 0) return emptySitemap('Invalid base URL.');

  let lastError = 'No sitemap found at known locations.';
  // Every candidate answered "not here" (404 / 410, or an HTML fallback page): the sitemap is
  // missing, not unknown. The Site chip reads this instead of parsing the error text (F3).
  let allNotFound = true;
  for (const candidate of candidates) {
    const res = await tryParseSitemap(candidate, pageHost);
    if (res.ok) {
      const built = await buildSitemapFromParsed(res.parsed, pageHost);
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
    if (!/^HTTP (404|410)$/.test(res.error) && !/returned HTML/i.test(res.error)) allNotFound = false;
  }
  const skippedNote = skipped.length
    ? ` Skipped ${skipped.length} robots.txt sitemap(s) on a private or local address: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? ', ...' : ''}.`
    : '';
  return {
    ...emptySitemap(`Tried ${candidates.length} location(s). Last error — ${lastError}${skippedNote}`),
    ...(allNotFound ? { notFound: true } : {}),
  };
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
  const fetched = await fetchText(target, hostOf(baseUrl));
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
  const fetched = await fetchText(target, hostOf(baseUrl));
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

let cacheKey: number | null = null;
const cache = new Map<string, Promise<SiteFiles>>();

/**
 * One `fetchSiteFiles` per origin per scan (UX review item 10). The Site tab, the AI tab and the
 * cloud upload each fetched robots.txt, llms.txt and up to 40 sitemaps on their own, and the tabs
 * did it again on every visit. `scanKey` is the scan the caller belongs to: a new key drops the
 * cache, so a re-scan sees the files as they are now. A failed fetch is not cached.
 */
export function fetchSiteFilesCached(
  baseUrl: string,
  scanKey: number,
  fetcher: (baseUrl: string) => Promise<SiteFiles> = fetchSiteFiles,
): Promise<SiteFiles> {
  if (scanKey !== cacheKey) {
    cache.clear();
    cacheKey = scanKey;
  }
  let origin = baseUrl;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    /* keep the raw value as the key */
  }
  const hit = cache.get(origin);
  if (hit) return hit;
  const pending = fetcher(baseUrl);
  cache.set(origin, pending);
  pending.catch(() => {
    if (cache.get(origin) === pending) cache.delete(origin);
  });
  return pending;
}

/**
 * Site files for the signed-in upload: the same cached fetch the Site and AI tabs read, but the
 * upload waits at most `waitMs` for it and then writes the scan without them (review High 4). A
 * slow or hostile site held the upload until every sitemap fetch had timed out, and in popup mode
 * the popup could close first, so the scan never synced.
 */
export function siteFilesForUpload(
  baseUrl: string,
  scanKey: number,
  waitMs: number = UPLOAD_SITE_FILES_WAIT_MS,
  fetcher: (baseUrl: string) => Promise<SiteFiles> = fetchSiteFiles,
): Promise<SiteFiles | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), waitMs);
    fetchSiteFilesCached(baseUrl, scanKey, fetcher).then(
      (files) => {
        clearTimeout(timer);
        resolve(files);
      },
      (err) => {
        clearTimeout(timer);
        // The scan is still written; the failure is kept for a bug report (diagnostics.ts).
        report(err, 'scan.site-files');
        resolve(undefined);
      },
    );
  });
}

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
  error?: string;
}

async function fetchText(url: string): Promise<FetchedDoc> {
  const res = await fetchWithTimeout(url);
  if (!res) return { ok: false, text: '', contentType: '', status: 0, error: 'Request failed or timed out.' };
  if (!res.ok) return { ok: false, text: '', contentType: res.headers.get('content-type') ?? '', status: res.status, error: `HTTP ${res.status}` };
  const text = await res.text();
  return {
    ok: true,
    text: text.length > MAX_BODY ? text.slice(0, MAX_BODY) : text,
    contentType: res.headers.get('content-type') ?? '',
    status: res.status,
  };
}

function looksLikeHtml(text: string, contentType: string): boolean {
  const ct = contentType.toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) return true;
  const head = text.slice(0, 200).trimStart().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return true;
  return false;
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

async function tryParseSitemap(url: string): Promise<{ ok: true; parsed: ParsedSitemap } | { ok: false; error: string }> {
  const fetched = await fetchText(url);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error ?? 'Fetch failed.' };
  }
  if (looksLikeHtml(fetched.text, fetched.contentType)) {
    return { ok: false, error: 'Server returned HTML (likely SPA fallback or missing route).' };
  }
  const parsed = parseSitemapXml(fetched.text);
  if (!parsed) {
    return { ok: false, error: 'Response was not a valid sitemap XML.' };
  }
  return { ok: true, parsed };
}

async function resolveSitemap(url: string, depth: number): Promise<SitemapChild> {
  const res = await tryParseSitemap(url);
  if (!res.ok) {
    return { url, urlCount: 0, isIndex: false, error: res.error };
  }
  const { parsed } = res;
  if (!parsed.isIndex || depth >= MAX_RECURSION_DEPTH) {
    return { url, urlCount: parsed.locs.length, isIndex: parsed.isIndex };
  }
  const childLocs = parsed.locs.slice(0, MAX_CHILDREN);
  const children = await Promise.all(childLocs.map((loc) => resolveSitemap(loc, depth + 1)));
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
  const children = await Promise.all(childLocs.map((loc) => resolveSitemap(loc, 1)));
  const total = children.reduce((sum, c) => sum + c.urlCount, 0);
  return {
    present: true,
    isIndex: true,
    urlCount: total,
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
    lastError = `${candidate}: ${res.error}`;
  }
  return emptySitemap(`Tried ${candidates.length} location(s). Last error — ${lastError}`);
}

function parseLlms(raw: string): LlmsSection[] {
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
      current.links.push({ label: link[1], url: link[2] });
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
  if (looksLikeHtml(fetched.text, fetched.contentType)) {
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
    sections: parseLlms(fetched.text),
  };
}

export async function fetchSiteFiles(baseUrl: string): Promise<SiteFiles> {
  const [robots, llms] = await Promise.all([buildRobots(baseUrl), buildLlms(baseUrl)]);
  const sitemap = await buildSitemap(baseUrl, robots.sitemaps);
  return { robots, sitemap, llms };
}

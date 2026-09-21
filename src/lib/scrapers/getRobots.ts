/**
 * Robots directives for the scanned page.
 *
 * Google takes the MOST RESTRICTIVE directive it can find, so this does too:
 * every `robots`/`googlebot` meta tag on the page counts, in any letter case, with directives
 * separated by whitespace or commas. `X-Robots-Tag` lives in the HTTP response, which a detached
 * DOM cannot see, so it is merged in later by `applyHeaderRobots` (see `getHeaderRobots.ts`).
 */

/** Where a noindex/nofollow was found, for the rule detail. */
export type RobotsSource = 'meta' | 'header' | null;

export interface RobotsInfo {
  /** Every `robots` meta content on the page, joined for display. Null when there is none. */
  robots: string | null;
  /** Every `googlebot` meta content on the page, joined for display. Null when there is none. */
  googlebot: string | null;
  /** Raw `X-Robots-Tag` response header, once resolved. Null when absent or not yet fetched. */
  header: string | null;
  noindex: boolean;
  nofollow: boolean;
  source: RobotsSource;
}

/** Split on commas AND whitespace: `content="noindex nofollow"` is two directives, not one. */
export function parseDirectives(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function contentsOf(html: HTMLElement, name: string): string[] {
  // `i` flag: attribute VALUES are case-sensitive in HTML except for a legacy list that does not
  // include `name`, so `name="Robots"` needs it. querySelectorAll, not querySelector: themes and
  // SEO plugins routinely emit two robots tags and the second is often the restrictive one.
  const els = Array.from(html.querySelectorAll(`meta[name="${name}" i]`));
  return els
    .map((el) => el.getAttribute('content')?.trim() ?? '')
    .filter((v) => v.length > 0);
}

function restricts(directives: Set<string>, which: 'noindex' | 'nofollow'): boolean {
  return directives.has(which) || directives.has('none');
}

export function getRobots(html: HTMLElement): RobotsInfo {
  const robotsContents = contentsOf(html, 'robots');
  const googlebotContents = contentsOf(html, 'googlebot');

  const directives = new Set<string>();
  for (const c of [...robotsContents, ...googlebotContents]) {
    for (const d of parseDirectives(c)) directives.add(d);
  }

  const noindex = restricts(directives, 'noindex');
  const nofollow = restricts(directives, 'nofollow');

  return {
    robots: robotsContents.length > 0 ? robotsContents.join(' | ') : null,
    googlebot: googlebotContents.length > 0 ? googlebotContents.join(' | ') : null,
    header: null,
    noindex,
    nofollow,
    source: noindex || nofollow ? 'meta' : null,
  };
}

/**
 * Merge an `X-Robots-Tag` response header into a DOM-derived result. Only ever makes the verdict
 * more restrictive: a header that says `index` does not undo a meta tag that says `noindex`.
 */
export function applyHeaderRobots(info: RobotsInfo, header: string | null): RobotsInfo {
  if (!header) return info;

  const directives = new Set<string>();
  // Header forms: `noindex`, `noindex, nofollow`, `googlebot: noindex`, and several headers the
  // fetch layer joins with ", ". A `<ua>:` prefix applies to that crawler only — we honour `*`,
  // `googlebot` and an unprefixed value, and ignore directives aimed at other named bots.
  for (const part of header.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    if (colon > 0) {
      const ua = trimmed.slice(0, colon).trim().toLowerCase();
      const rest = trimmed.slice(colon + 1);
      // `unavailable_after: <date>` is a directive, not a user-agent prefix.
      if (ua === '*' || ua === 'googlebot' || ua === 'unavailable_after') {
        if (ua === 'unavailable_after') directives.add('unavailable_after');
        else for (const d of parseDirectives(rest)) directives.add(d);
      }
      continue;
    }
    for (const d of parseDirectives(trimmed)) directives.add(d);
  }

  const headerNoindex = restricts(directives, 'noindex');
  const headerNofollow = restricts(directives, 'nofollow');

  return {
    ...info,
    header,
    noindex: info.noindex || headerNoindex,
    nofollow: info.nofollow || headerNofollow,
    source: info.source ?? (headerNoindex || headerNofollow ? 'header' : null),
  };
}

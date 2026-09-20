import { categorize } from '../categorize';
import type { MetaTag, PageMeta, TagSource } from './PageMeta';
import { getJsonLd } from './getJsonLd';
import { getHreflang } from './getHreflang';
import { getRobots } from './getRobots';

function resolveUrl(raw: string | null, baseUrl: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, baseUrl || undefined).toString();
  } catch {
    return trimmed;
  }
}

export function getMetaTags(html: HTMLElement, baseUrl: string = ''): PageMeta {
  // `<base href>` changes what every relative URL on the page resolves against. Without honouring
  // it, a relative canonical or hreflang resolved against the wrong base and the rules judged a
  // URL the browser never uses.
  const baseHref = html.querySelector('base[href]')?.getAttribute('href') ?? null;
  const effectiveBase = resolveUrl(baseHref, baseUrl) ?? baseUrl;

  // Scoped to <head>: an inline SVG `<title>` (an accessible name for an icon, anywhere in the
  // body) used to satisfy the required page-title rule on a page that has no title at all.
  const headTitles = Array.from(html.querySelectorAll('head title'));
  const titleEl = headTitles[0];
  const titleText = titleEl?.textContent?.trim() ?? '';
  const title: string | null = titleText.length > 0 ? titleText : null;

  // `rel` is case-insensitive AND space-separated (`rel="canonical alternate"` is valid), so match
  // on the parsed token list rather than an exact attribute value.
  const links = Array.from(html.querySelectorAll('link[rel]'));
  const relTokens = (el: Element): string[] =>
    (el.getAttribute('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const linksWithRel = (rel: string): Element[] => links.filter((el) => relTokens(el).includes(rel));

  const canonicalEls = linksWithRel('canonical');
  const canonical = resolveUrl(canonicalEls[0]?.getAttribute('href') ?? null, effectiveBase);

  const iconEl =
    linksWithRel('icon')[0] ??
    linksWithRel('shortcut')[0] ??
    linksWithRel('apple-touch-icon')[0] ??
    null;
  const icon = resolveUrl(iconEl?.getAttribute('href') ?? null, effectiveBase);

  const tags: MetaTag[] = [];
  const metaEls = html.querySelectorAll('meta');
  metaEls.forEach((el) => {
    const property = el.getAttribute('property');
    const name = el.getAttribute('name');
    const content = el.getAttribute('content');
    if (!content) return;

    const value = content.trim();
    if (!value) return;

    let key: string | null = null;
    let source: TagSource = 'property';
    if (property && property.trim().length > 0) {
      key = property.trim();
      source = 'property';
    } else if (name && name.trim().length > 0) {
      key = name.trim();
      source = 'name';
    }
    if (!key) return;

    tags.push({
      key,
      value,
      source,
      category: categorize(key),
    });
  });

  return {
    pageUrl: baseUrl || null,
    title,
    canonical,
    icon,
    tags,
    // Duplicate <title> and <link rel=canonical> are structurally invisible to the dup-tags rule,
    // which only counts <meta> elements — so the counts are reported here instead.
    duplicates: { title: headTitles.length, canonical: canonicalEls.length },
    jsonLd: getJsonLd(html),
    hreflang: getHreflang(html, effectiveBase),
    robots: getRobots(html),
  };
}

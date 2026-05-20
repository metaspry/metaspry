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
  const titleEl = html.querySelector('title');
  const titleText = titleEl?.textContent?.trim() ?? '';
  const title: string | null = titleText.length > 0 ? titleText : null;

  const canonicalEl = html.querySelector('link[rel="canonical"]');
  const canonical = resolveUrl(canonicalEl?.getAttribute('href') ?? null, baseUrl);

  const iconEl =
    html.querySelector('link[rel="icon"]') ||
    html.querySelector('link[rel="shortcut icon"]') ||
    html.querySelector('link[rel="apple-touch-icon"]');
  const icon = resolveUrl(iconEl?.getAttribute('href') ?? null, baseUrl);

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
    title,
    canonical,
    icon,
    tags,
    jsonLd: getJsonLd(html),
    hreflang: getHreflang(html, baseUrl),
    robots: getRobots(html),
  };
}

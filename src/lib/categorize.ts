import type { TagCategory } from './scrapers/PageMeta';

const SEO_KEYS = new Set([
  'description',
  'keywords',
  'robots',
  'canonical',
  'author',
  'googlebot',
]);

const BASIC_KEYS = new Set([
  'charset',
  'viewport',
  'title',
  'icon',
  'theme-color',
  'referrer',
  'generator',
  'application-name',
  'format-detection',
  'msapplication-tilecolor',
  'msapplication-config',
  'apple-mobile-web-app-title',
  'apple-mobile-web-app-capable',
]);

export function categorize(rawKey: string): TagCategory {
  const key = rawKey.toLowerCase();
  if (key.startsWith('og:')) return 'og';
  if (key.startsWith('twitter:')) return 'twitter';
  if (SEO_KEYS.has(key)) return 'seo';
  if (BASIC_KEYS.has(key)) return 'basic';
  return 'other';
}

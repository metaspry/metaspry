import type { JsonLdResult } from './getJsonLd';
import type { HreflangEntry } from './getHreflang';
import type { RobotsInfo } from './getRobots';

export type TagCategory = 'og' | 'twitter' | 'seo' | 'basic' | 'other';

export type CategoryFilter = TagCategory | 'all';

export type TagSource = 'property' | 'name' | 'title' | 'link';

export interface MetaTag {
  key: string;
  value: string;
  source: TagSource;
  category: TagCategory;
}

export interface PageMeta {
  title: string | null;
  canonical: string | null;
  icon: string | null;
  tags: MetaTag[];
  jsonLd: JsonLdResult;
  hreflang: HreflangEntry[];
  robots: RobotsInfo;
}

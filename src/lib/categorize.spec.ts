import { describe, it, expect } from 'vitest';
import { categorize } from './categorize';

describe('categorize', () => {
  it.each([
    ['og:title', 'og'],
    ['OG:Image', 'og'],
    ['article:published_time', 'og'],
    ['twitter:card', 'twitter'],
    ['description', 'seo'],
    ['googlebot', 'seo'],
    ['viewport', 'basic'],
    ['theme-color', 'basic'],
    ['fb:app_id', 'other'],
  ])('%s -> %s', (key, cat) => {
    expect(categorize(key)).toBe(cat);
  });
});

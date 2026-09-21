export interface RobotsGroup {
  userAgents: string[];
  disallow: string[];
  allow: string[];
}

export interface RobotsInfo {
  present: boolean;
  raw: string | null;
  groups: RobotsGroup[];
  sitemaps: string[];
  error?: string;
}

export interface SitemapChild {
  url: string;
  urlCount: number;
  isIndex: boolean;
  error?: string;
}

export interface SitemapInfo {
  /**
   * True when the fetch budget stopped us before every child sitemap was read, so `urlCount` is a
   * floor rather than a total. Without this the headline summed the unread children as zero and
   * asserted a number built partly from nothing.
   */
  budgetExhausted?: boolean;
  present: boolean;
  isIndex: boolean;
  urlCount: number;
  childCount: number;
  children: SitemapChild[];
  sample: string[];
  truncated: boolean;
  error?: string;
}

export interface LlmsSection {
  heading: string;
  links: { label: string; url: string }[];
}

export interface LlmsInfo {
  present: boolean;
  raw: string | null;
  sections: LlmsSection[];
  error?: string;
}

export interface SiteFiles {
  robots: RobotsInfo;
  sitemap: SitemapInfo;
  llms: LlmsInfo;
}

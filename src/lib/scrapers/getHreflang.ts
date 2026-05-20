export interface HreflangEntry {
  hreflang: string;
  href: string;
}

function resolve(raw: string, baseUrl: string): string {
  try {
    return new URL(raw, baseUrl || undefined).toString();
  } catch {
    return raw;
  }
}

export function getHreflang(html: HTMLElement, baseUrl: string = ''): HreflangEntry[] {
  const links = html.querySelectorAll('link[rel="alternate"][hreflang]');
  const out: HreflangEntry[] = [];
  links.forEach((el) => {
    const hreflang = el.getAttribute('hreflang')?.trim();
    const href = el.getAttribute('href')?.trim();
    if (hreflang && href) {
      out.push({ hreflang, href: resolve(href, baseUrl) });
    }
  });
  return out;
}

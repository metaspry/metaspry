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
  // `rel` is case-insensitive and space-separated, so match on the token list — the same rule
  // getMetaTags uses. The exact-attribute selector made `rel="ALTERNATE"` and
  // `rel="alternate stylesheet"` invisible, and the hreflang-self fix could never fire on them.
  const links = Array.from(html.querySelectorAll('link[hreflang]')).filter((el) =>
    (el.getAttribute('rel') ?? '')
      .toLowerCase()
      .split(/\s+/)
      .includes('alternate')
  );
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

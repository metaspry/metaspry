/**
 * A URL taken from the audited site (robots.txt `Sitemap:` lines, sitemap `<loc>` entries, llms.txt
 * links) is rendered as a clickable link inside the extension's own page. Anything that is not
 * http(s) — `javascript:`, `data:`, `file:` — has no business being clickable there, so it is shown
 * as plain text instead.
 */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

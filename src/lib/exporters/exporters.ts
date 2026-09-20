import type { PageMeta } from '../scrapers/PageMeta';

export function toJson(meta: PageMeta): string {
  return JSON.stringify(
    {
      title: meta.title,
      canonical: meta.canonical,
      icon: meta.icon,
      tags: meta.tags,
      hreflang: meta.hreflang,
      robots: meta.robots,
      jsonLd: meta.jsonLd,
    },
    null,
    2
  );
}

/** Leading characters a spreadsheet treats as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\n\r\t]/;

/**
 * Every value in this CSV comes from the audited site. A cell starting with `=`, `+`, `-`, `@` or
 * a control character is executed as a formula when the file is opened in Excel, Sheets or
 * Numbers, so it is prefixed with a tab, the standard neutralisation.
 */
function csvEscape(value: string): string {
  const neutralised = FORMULA_START.test(value) ? `\t${value}` : value;
  if (NEEDS_QUOTES.test(neutralised)) {
    return `"${neutralised.replace(/"/g, '""')}"`;
  }
  return neutralised;
}

export function toCsv(meta: PageMeta): string {
  const rows: string[] = ['key,value,source,category'];
  if (meta.title) rows.push(`title,${csvEscape(meta.title)},title,basic`);
  if (meta.canonical) rows.push(`canonical,${csvEscape(meta.canonical)},link,seo`);
  if (meta.icon) rows.push(`icon,${csvEscape(meta.icon)},link,basic`);
  for (const t of meta.tags) {
    rows.push(`${csvEscape(t.key)},${csvEscape(t.value)},${t.source},${t.category}`);
  }
  return rows.join('\n');
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

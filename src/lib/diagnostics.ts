/**
 * What went wrong, kept for a bug report (architecture review 2026-10-26, Medium 16). Failures the
 * UI deliberately absorbs (a site-files fetch, the Compare left-side refetch, a workspace list, a
 * sign-out) used to vanish without a trace, so a user's "it didn't work" had nothing behind it.
 *
 * In memory only, per surface, the last MAX entries; nothing leaves the browser. Settings > "Copy
 * diagnostics" puts `diagnosticsText()` on the clipboard for the user to paste into an issue.
 */

export interface DiagnosticEntry {
  at: number;
  /** Where it happened, e.g. 'scan.site-files', 'compare.left-fetch'. */
  context: string;
  message: string;
  name?: string;
}

const MAX = 50;
const entries: DiagnosticEntry[] = [];

function describe(err: unknown): { message: string; name?: string } {
  if (err instanceof Error) return { message: err.message || String(err), name: err.name };
  if (err && typeof err === 'object' && 'code' in err) return { message: String((err as { code: unknown }).code) };
  try {
    return { message: typeof err === 'string' ? err : JSON.stringify(err) ?? String(err) };
  } catch {
    return { message: String(err) };
  }
}

/** Records a failure. Never throws, whatever `err` is. */
export function report(err: unknown, context: string, now: () => number = Date.now): void {
  try {
    const d = describe(err);
    entries.push({ at: now(), context, message: d.message.slice(0, 500), ...(d.name ? { name: d.name } : {}) });
    if (entries.length > MAX) entries.splice(0, entries.length - MAX);
    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') console.warn(`[metaspry] ${context}`, err);
  } catch {
    /* diagnostics must never break the caller */
  }
}

export function diagnosticEntries(): readonly DiagnosticEntry[] {
  return entries.slice();
}

/** For tests. */
export function clearDiagnostics(): void {
  entries.length = 0;
}

/** Plain text for an issue: version, browser, surface, then the entries, newest last. */
export function diagnosticsText(meta: { version: string; userAgent: string; mode: string }): string {
  const lines = [
    `Metaspry ${meta.version}`,
    `Browser: ${meta.userAgent}`,
    `Surface: ${meta.mode}`,
    `Entries: ${entries.length}`,
    ...entries.map((e) => `${new Date(e.at).toISOString()} ${e.context}: ${e.name ? `${e.name}: ` : ''}${e.message}`),
  ];
  return lines.join('\n');
}

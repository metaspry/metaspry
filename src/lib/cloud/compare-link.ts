/**
 * Deep link from a synced scan into the web app's diff of that scan against its previous
 * stored version. The app owns the meaning of `@prev` (newest version under
 * `<scan>/versions`, written by the app's `onScanWritten` trigger from the document that was
 * there before the write) and shows its own `no-version` state when there is nothing to
 * compare, so this never inspects the id or the versions.
 */
import { APP_URL } from './plan';

/**
 * `${APP_URL}/compare?a=scan:<id>@prev&b=scan:<id>` (both refs URL-encoded), plus `&ws=<id>` when the
 * scan was saved to a workspace (architecture review 2026-10-26, Medium 13). The app resolves `scan:`
 * refs in its current scope, so a workspace scan opened as "not found" from a personal-scope tab;
 * its `(app)` layout switches to the `ws` workspace (and drops the parameter) when the user is a
 * member, and ignores an id they are not.
 */
export function compareChangedHref(scanId: string, workspaceId: string | null = null): string {
  const a = encodeURIComponent(`scan:${scanId}@prev`);
  const b = encodeURIComponent(`scan:${scanId}`);
  const ws = workspaceId ? `&ws=${encodeURIComponent(workspaceId)}` : '';
  return `${APP_URL}/compare?a=${a}&b=${b}${ws}`;
}

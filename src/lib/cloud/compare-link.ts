/**
 * Deep link from a synced scan into the web app's diff of that scan against its previous
 * stored version. The app owns the meaning of `@prev` (newest version under
 * `<scan>/versions`, written by the app's `onScanWritten` trigger from the document that was
 * there before the write) and shows its own `no-version` state when there is nothing to
 * compare, so this never inspects the id or the versions.
 */
import { APP_URL } from './plan';

/** `${APP_URL}/compare?a=scan:<id>@prev&b=scan:<id>` (both refs URL-encoded). */
export function compareChangedHref(scanId: string): string {
  const a = encodeURIComponent(`scan:${scanId}@prev`);
  const b = encodeURIComponent(`scan:${scanId}`);
  return `${APP_URL}/compare?a=${a}&b=${b}`;
}

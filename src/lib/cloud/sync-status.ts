/**
 * What happened to the last scan upload (UX review item 1). The account menu used to say "Synced"
 * unconditionally while `scrape()` swallowed every upload error, so a user whose writes were all
 * rejected believed their history was in the app.
 */
import { writable, type Writable } from 'svelte/store';

export type SyncState =
  | { kind: 'idle' }
  | { kind: 'saving'; target: string }
  | { kind: 'saved'; target: string; at: number }
  | { kind: 'error'; target: string; message: string };

export const scanSync = writable<SyncState>({ kind: 'idle' });

/** A plain sentence for a failed Firestore write; never the raw code. */
export function syncErrorMessage(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
  switch (code.replace(/^firestore\//, '')) {
    case 'permission-denied':
      return "Your account isn't allowed to save to this target. Check the workspace in the account menu.";
    case 'unauthenticated':
      return 'Your sign-in expired. Sign in again to save scans.';
    case 'resource-exhausted':
      return 'Your account has reached its saved-scan limit.';
    case 'unavailable':
    case 'deadline-exceeded':
      return "Couldn't reach Metaspry. Check your connection and re-scan.";
    default:
      return "Couldn't save this scan to your account. Re-scan to try again.";
  }
}

let latest = 0;

let lastUid: string | null | undefined;
/**
 * Back to idle when the signed-in account changes (or signs out): user A's failed upload must not
 * show as user B's "last scan not saved". Also drops a result still in flight for A.
 */
export function resetSyncFor(uid: string | null, store: Writable<SyncState> = scanSync): void {
  if (uid === lastUid) return;
  lastUid = uid;
  latest++;
  store.set({ kind: 'idle' });
}

/**
 * Runs one upload and mirrors it in `store`: saving, then saved or error. Only the most recent call
 * may write the final state, so a slow earlier upload cannot overwrite a newer one. Returns the
 * upload's result, or null when it failed; it never throws.
 */
export async function trackUpload<T>(
  target: string,
  run: () => Promise<T>,
  store: Writable<SyncState> = scanSync,
  now: () => number = Date.now,
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  const id = ++latest;
  store.set({ kind: 'saving', target });
  try {
    const value = await run();
    if (id === latest) store.set({ kind: 'saved', target, at: now() });
    return { ok: true, value };
  } catch (err) {
    const message = syncErrorMessage(err);
    if (id === latest) store.set({ kind: 'error', target, message });
    return { ok: false, message };
  }
}

/**
 * While an upload is in flight, closing the side panel (or a tab running the page) would drop it:
 * ask first. A popup that loses focus closes without this prompt, so the account menu also says
 * "keep this open" while saving.
 */
export function guardUnload(store: Writable<SyncState> = scanSync, target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window): () => void {
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = '';
  };
  let armed = false;
  const unsub = store.subscribe((s) => {
    const want = s.kind === 'saving';
    if (want === armed) return;
    armed = want;
    if (want) target.addEventListener('beforeunload', onBeforeUnload);
    else target.removeEventListener('beforeunload', onBeforeUnload);
  });
  return () => {
    unsub();
    if (armed) target.removeEventListener('beforeunload', onBeforeUnload);
  };
}

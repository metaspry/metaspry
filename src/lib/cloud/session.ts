/**
 * Whether this browser may hold a Firebase session, answered WITHOUT loading the SDK (UX review
 * item 11): a signed-out user should not pay for Firebase on every open.
 *
 * 1. `cloudSession` in chrome.storage.local, written on every auth state change (true signed in,
 *    false signed out). Shared by the popup and side panel, which also watch it to start auth when
 *    the other surface signs in.
 * 2. Absent (installs from before this key): look in IndexedDB for the session Firebase's
 *    web-extension auth persists (`firebaseLocalStorageDb` / `firebaseLocalStorage`, keys
 *    `firebase:authUser:*`). On any doubt the answer is "maybe", which loads Firebase as before.
 */
export const SESSION_HINT_KEY = 'cloudSession';
const DB_NAME = 'firebaseLocalStorageDb';
const STORE = 'firebaseLocalStorage';

type IdbLike = Pick<IDBFactory, 'open'> & { databases?: () => Promise<{ name?: string }[]> };

export function readSessionHint(): Promise<boolean | null> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(null);
      return;
    }
    chrome.storage.local.get(SESSION_HINT_KEY, (r) => {
      const v = r?.[SESSION_HINT_KEY];
      resolve(v === true ? true : v === false ? false : null);
    });
  });
}

export function writeSessionHint(signedIn: boolean): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [SESSION_HINT_KEY]: signedIn });
}

/** True when Firebase's IndexedDB holds a persisted user, or when that cannot be ruled out. */
export async function hasStoredSession(idb: IdbLike | undefined = globalThis.indexedDB): Promise<boolean> {
  if (!idb) return false;
  try {
    if (typeof idb.databases === 'function') {
      const dbs = await idb.databases();
      if (!dbs.some((d) => d.name === DB_NAME)) return false;
    }
  } catch {
    return true;
  }
  return new Promise<boolean>((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = idb.open(DB_NAME);
    } catch {
      resolve(true);
      return;
    }
    // The database does not exist: abort, so probing never creates an empty one under Firebase.
    req.onupgradeneeded = () => {
      req.transaction?.abort();
      resolve(false);
    };
    req.onerror = () => resolve(true);
    req.onblocked = () => resolve(true);
    req.onsuccess = () => {
      const db = req.result;
      try {
        if (!db.objectStoreNames.contains(STORE)) {
          db.close();
          resolve(false);
          return;
        }
        const keys = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
        keys.onsuccess = () => {
          db.close();
          resolve(keys.result.some((k) => String(k).startsWith('firebase:authUser:')));
        };
        keys.onerror = () => {
          db.close();
          resolve(true);
        };
      } catch {
        db.close();
        resolve(true);
      }
    };
  });
}

/** Should auth start at open? The stored hint if there is one, else the IndexedDB probe. */
export async function maySignedIn(
  readHint: () => Promise<boolean | null> = readSessionHint,
  probe: () => Promise<boolean> = hasStoredSession,
): Promise<boolean> {
  const hint = await readHint();
  return hint === null ? probe() : hint;
}

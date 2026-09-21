/**
 * Cross-surface storage sync.
 *
 * The popup and the side panel are separate documents with separate store instances. Each one
 * hydrates from `chrome.storage` at mount and then writes its whole value on every change, so
 * without this, a scan recorded in one surface is erased the next time the other writes its stale
 * copy back. Every store that persists to `chrome.storage.local` re-hydrates through `watchKey`.
 */

export interface WriteGuard {
  /** True while an external change is being applied: the store's own writer must stand down. */
  readonly suppressed: boolean;
  /** Apply an external value without echoing it straight back to storage. */
  applyExternal: (fn: () => void) => void;
}

export function makeWriteGuard(): WriteGuard {
  let depth = 0;
  return {
    get suppressed() {
      return depth > 0;
    },
    applyExternal(fn: () => void) {
      depth += 1;
      try {
        fn();
      } finally {
        depth -= 1;
      }
    },
  };
}

/** Call `apply` whenever another surface changes `key` in `chrome.storage.local`. */
export function watchKey(key: string, apply: (raw: unknown) => void): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes[key];
    if (!change) return;
    apply(change.newValue);
  });
}

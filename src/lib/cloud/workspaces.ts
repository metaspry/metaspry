/**
 * Team workspaces visible to the signed-in extension user, and the chosen sync target
 * (Personal vs a workspace). New scans upload to the selected scope. Only workspaces the user
 * can write to (owner/member) are offered; the choice persists in chrome.storage.
 */
import { writable, get } from 'svelte/store';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { fbDb } from './firebase';
import { cloudUser } from './auth';

export interface CloudWorkspace {
  id: string;
  name: string;
  role: string;
  /** Plan is not 'inactive' (the app's `workspaceEntitled`): custom scoring for every member. */
  entitled: boolean;
}

export type SyncScope = { kind: 'personal' } | { kind: 'workspace'; wsId: string; name: string };

export const workspaces = writable<CloudWorkspace[]>([]);
export const syncScope = writable<SyncScope>({ kind: 'personal' });

/**
 * The stored scope is namespaced per user. One shared key meant a direct account switch briefly
 * showed, and could upload to, the previous user's workspace.
 */
const SCOPE_KEY = 'syncScope';
export function scopeKeyFor(uid: string | null | undefined): string {
  return uid ? `${SCOPE_KEY}__${uid}` : SCOPE_KEY;
}

function persistScope(s: SyncScope, uid: string | null): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [scopeKeyFor(uid)]: s });
}

function loadScope(uid: string | null): Promise<SyncScope> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve({ kind: 'personal' });
      return;
    }
    const key = scopeKeyFor(uid);
    chrome.storage.local.get(key, (r) => {
      const s = r[key] as SyncScope | undefined;
      resolve(s && s.kind === 'workspace' ? s : { kind: 'personal' });
    });
  });
}

export function setSyncScope(s: SyncScope): void {
  syncScope.set(s);
  persistScope(s, get(cloudUser)?.uid ?? null);
}

export async function fetchWorkspaces(uid: string): Promise<void> {
  try {
    const snap = await getDocs(
      query(collection(fbDb(), 'workspaces'), where('memberUids', 'array-contains', uid)),
    );
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name ?? 'Workspace'),
          role: data.roles?.[uid],
          entitled: data.plan !== 'inactive',
        };
      })
      .filter((w) => w.role === 'owner' || w.role === 'member');
    workspaces.set(list);
    // If the saved target workspace is gone / no longer writable, fall back to personal.
    const cur = get(syncScope);
    if (cur.kind === 'workspace' && !list.some((w) => w.id === cur.wsId)) {
      setSyncScope({ kind: 'personal' });
    }
  } catch {
    workspaces.set([]);
  }
}

let started = false;
export function initCloudWorkspaces(): void {
  if (started) return;
  started = true;
  cloudUser.subscribe((u) => {
    // Reset first on every auth change, then load THIS user's stored scope. Loading a shared key
    // once at startup meant user B briefly saw user A's workspace selected.
    syncScope.set({ kind: 'personal' });
    if (u) {
      void fetchWorkspaces(u.uid);
      void loadScope(u.uid).then((s) => syncScope.set(s));
    } else {
      workspaces.set([]);
    }
  });
}

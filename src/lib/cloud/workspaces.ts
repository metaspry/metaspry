/**
 * Team workspaces visible to the signed-in extension user, and the chosen sync target
 * (Personal vs a workspace). New scans upload to the selected scope. Only workspaces the user
 * can write to (owner/member) are offered; the choice persists in chrome.storage.
 */
import { writable, get } from 'svelte/store';
import { firestoreSdk } from './sdk';
import { cloudUser } from './auth';
import { report } from '../diagnostics';
import { toast } from '../toast';

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
    const { db, collection, getDocs, query, where } = await firestoreSdk();
    const snap = await getDocs(
      query(collection(db, 'workspaces'), where('memberUids', 'array-contains', uid)),
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
    // The user changed while this was in flight: their own fetch has (or will) set the list.
    if (get(cloudUser)?.uid !== uid) return;
    workspaces.set(list);
    // If the saved target workspace is gone / no longer writable, fall back to personal.
    const cur = get(syncScope);
    if (cur.kind === 'workspace' && !list.some((w) => w.id === cur.wsId)) {
      setSyncScope({ kind: 'personal' });
      // It used to switch silently, so a team member's scans started landing in Personal unnoticed
      // (UX review 2026-10-25, Medium 20).
      toast(`You no longer have access to ${cur.name}. New scans save to Personal.`, 'default');
    }
  } catch (err) {
    report(err, 'cloud.workspaces');
    if (get(cloudUser)?.uid === uid) workspaces.set([]);
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
      // Dropped when another account signed in before it loaded (architecture review 2026-10-26, High 5).
      void loadScope(u.uid).then((s) => {
        if (get(cloudUser)?.uid === u.uid) syncScope.set(s);
      });
    } else {
      workspaces.set([]);
    }
  });
}

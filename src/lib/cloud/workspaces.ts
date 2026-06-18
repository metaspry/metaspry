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
}

export type SyncScope = { kind: 'personal' } | { kind: 'workspace'; wsId: string; name: string };

export const workspaces = writable<CloudWorkspace[]>([]);
export const syncScope = writable<SyncScope>({ kind: 'personal' });

const SCOPE_KEY = 'syncScope';

function persistScope(s: SyncScope): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [SCOPE_KEY]: s });
}

function loadScope(): Promise<SyncScope> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve({ kind: 'personal' });
      return;
    }
    chrome.storage.local.get(SCOPE_KEY, (r) => {
      const s = r[SCOPE_KEY] as SyncScope | undefined;
      resolve(s && s.kind === 'workspace' ? s : { kind: 'personal' });
    });
  });
}

export function setSyncScope(s: SyncScope): void {
  syncScope.set(s);
  persistScope(s);
}

export async function fetchWorkspaces(uid: string): Promise<void> {
  try {
    const snap = await getDocs(
      query(collection(fbDb(), 'workspaces'), where('memberUids', 'array-contains', uid)),
    );
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return { id: d.id, name: String(data.name ?? 'Workspace'), role: data.roles?.[uid] };
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
  void loadScope().then((s) => syncScope.set(s));
  cloudUser.subscribe((u) => {
    if (u) void fetchWorkspaces(u.uid);
    else {
      workspaces.set([]);
      setSyncScope({ kind: 'personal' });
    }
  });
}

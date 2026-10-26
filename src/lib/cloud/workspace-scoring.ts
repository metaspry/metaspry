/**
 * Workspace scoring rules (R-39). The web app licenses per workspace: an entitled workspace (plan
 * anything but 'inactive': the Pro plan's included workspace, Team, legacy) unlocks custom scoring
 * for every member, whatever their personal plan. When the extension's sync target is such a
 * workspace, scans are scored with that workspace's rules (`workspaces/{wsId}/settings/audit`,
 * readable by members under the app's firestore.rules), the same rules the app applies in that
 * scope. They are read-only here: they are edited in the web app.
 */
import { writable, derived, type Readable } from 'svelte/store';
import { firestoreSdk } from './sdk';
import { syncScope, workspaces } from './workspaces';
import { DEFAULT_SETTINGS, normalizeAuditSettings, type Settings } from '../storage/settings';

export interface WorkspaceRules {
  wsId: string;
  name: string;
  settings: Settings;
}

/** Mirrors the app's `workspaceEntitled`: only an explicit 'inactive' locks a workspace. */
export function workspacePlanEntitled(plan: unknown): boolean {
  return plan !== 'inactive';
}

/** Moved to `storage/settings.ts` (one normaliser for every read path); re-exported here. */
export { normalizeAuditSettings } from '../storage/settings';

/**
 * The settings that score a scan: the target workspace's rules when it is entitled, else the
 * personal rules for a personal Pro, else the defaults.
 */
export function resolveEffectiveSettings(personal: Settings, isPro: boolean, ws: WorkspaceRules | null): Settings {
  if (ws) return ws.settings;
  return isPro ? personal : DEFAULT_SETTINGS;
}

export const workspaceRules = writable<WorkspaceRules | null>(null);

/** True when the user belongs (owner/member) to at least one entitled workspace: never upsell Pro. */
export const hasEntitledWorkspace: Readable<boolean> = derived(workspaces, ($ws) => $ws.some((w) => w.entitled));

let started = false;
let unsub: (() => void) | null = null;
let watching: string | null = null;
// Bumped on every target change: an SDK load that lands after another change (A -> none -> A while
// it loaded) must not attach a second listener (plan.ts does the same).
let token = 0;

export function initWorkspaceScoring(): void {
  if (started) return;
  started = true;
  derived([syncScope, workspaces], ([$scope, $ws]) => {
    if ($scope.kind !== 'workspace') return null;
    const w = $ws.find((x) => x.id === $scope.wsId);
    return w && w.entitled ? { wsId: w.id, name: w.name } : null;
  }).subscribe((target) => {
    const key = target ? target.wsId : null;
    if (key === watching) {
      if (target) workspaceRules.update((r) => (r ? { ...r, name: target.name } : r));
      return;
    }
    unsub?.();
    unsub = null;
    watching = key;
    const mine = ++token;
    if (!target) {
      workspaceRules.set(null);
      return;
    }
    // Until the document arrives, the workspace scores with the defaults (a missing document is
    // the defaults in the app too), never with the personal rules.
    workspaceRules.set({ wsId: target.wsId, name: target.name, settings: DEFAULT_SETTINGS });
    void firestoreSdk()
      .then(({ db, doc, onSnapshot }) => {
        // The target changed while the SDK loaded.
        if (mine !== token) return;
        unsub = onSnapshot(
          doc(db, 'workspaces', target.wsId, 'settings', 'audit'),
          (snap) => {
            if (watching !== target.wsId) return;
            workspaceRules.set({ wsId: target.wsId, name: target.name, settings: normalizeAuditSettings(snap.data()) });
          },
          () => {
            if (watching === target.wsId) workspaceRules.set({ wsId: target.wsId, name: target.name, settings: DEFAULT_SETTINGS });
          },
        );
      })
      .catch(() => {
        /* stays on the defaults, as for a snapshot error */
      });
  });
}

/**
 * Workspace scoring rules (R-39). The web app licenses per workspace: an entitled workspace (plan
 * anything but 'inactive': the Pro plan's included workspace, Team, legacy) unlocks custom scoring
 * for every member, whatever their personal plan. When the extension's sync target is such a
 * workspace, scans are scored with that workspace's rules (`workspaces/{wsId}/settings/audit`,
 * readable by members under the app's firestore.rules), the same rules the app applies in that
 * scope. They are read-only here: they are edited in the web app.
 */
import { writable, derived, type Readable } from 'svelte/store';
import { doc, onSnapshot } from 'firebase/firestore';
import { fbDb } from './firebase';
import { syncScope, workspaces } from './workspaces';
import { DEFAULT_SETTINGS, type Settings } from '../storage/settings';

export interface WorkspaceRules {
  wsId: string;
  name: string;
  settings: Settings;
}

/** Mirrors the app's `workspaceEntitled`: only an explicit 'inactive' locks a workspace. */
export function workspacePlanEntitled(plan: unknown): boolean {
  return plan !== 'inactive';
}

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);

/** A stored settings document merged over the defaults; anything non-numeric falls back. */
export function normalizeAuditSettings(raw: unknown): Settings {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const w = (d.weights && typeof d.weights === 'object' ? d.weights : {}) as Record<string, unknown>;
  return {
    titleMin: num(d.titleMin, DEFAULT_SETTINGS.titleMin),
    titleMax: num(d.titleMax, DEFAULT_SETTINGS.titleMax),
    descMin: num(d.descMin, DEFAULT_SETTINGS.descMin),
    descMax: num(d.descMax, DEFAULT_SETTINGS.descMax),
    ogDescMin: num(d.ogDescMin, DEFAULT_SETTINGS.ogDescMin),
    ogDescMax: num(d.ogDescMax, DEFAULT_SETTINGS.ogDescMax),
    weights: {
      required: num(w.required, DEFAULT_SETTINGS.weights.required),
      recommended: num(w.recommended, DEFAULT_SETTINGS.weights.recommended),
      'best-practice': num(w['best-practice'], DEFAULT_SETTINGS.weights['best-practice']),
    },
  };
}

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
    if (!target) {
      workspaceRules.set(null);
      return;
    }
    // Until the document arrives, the workspace scores with the defaults (a missing document is
    // the defaults in the app too), never with the personal rules.
    workspaceRules.set({ wsId: target.wsId, name: target.name, settings: DEFAULT_SETTINGS });
    unsub = onSnapshot(
      doc(fbDb(), 'workspaces', target.wsId, 'settings', 'audit'),
      (snap) => {
        if (watching !== target.wsId) return;
        workspaceRules.set({ wsId: target.wsId, name: target.name, settings: normalizeAuditSettings(snap.data()) });
      },
      () => {
        if (watching === target.wsId) workspaceRules.set({ wsId: target.wsId, name: target.name, settings: DEFAULT_SETTINGS });
      },
    );
  });
}

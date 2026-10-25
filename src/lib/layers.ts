/**
 * The stack of open layers (dialogs, drawers, menus), UX review item 6. Each layer used to listen
 * for Escape and Tab on its own, so the shortcuts help opened over Settings let Tab land in the
 * drawer behind it and one Escape closed both; single-key shortcuts also fired behind an open
 * dialog. Now only the top layer handles keys, shortcuts are muted while any layer is open, and a
 * modal layer makes the page behind it inert (Extension.svelte).
 */
import { derived, get, writable } from 'svelte/store';

export interface Layer {
  readonly id: symbol;
  readonly modal: boolean;
}

const stack = writable<Layer[]>([]);

/** Any layer (dialog, drawer or menu) is open. */
export const layerOpen = derived(stack, (s) => s.length > 0);
/** A modal layer (Settings, shortcuts help) is open: the page behind it is inert. */
export const modalOpen = derived(stack, (s) => s.some((l) => l.modal));
/** The topmost layer, or null. */
export const topLayer = derived(stack, (s) => s[s.length - 1] ?? null);

/** Puts a layer on top of the stack; call the returned function when it closes. */
export function pushLayer(modal: boolean, name = 'layer'): { layer: Layer; release: () => void } {
  const layer: Layer = { id: Symbol(name), modal };
  stack.update((s) => [...s, layer]);
  return {
    layer,
    release: () => stack.update((s) => s.filter((l) => l !== layer)),
  };
}

/** True when `layer` is the one that should handle Escape / Tab right now. */
export function isTop(layer: Layer | null): boolean {
  return layer !== null && get(topLayer) === layer;
}

/** For tests. */
export function resetLayers(): void {
  stack.set([]);
}

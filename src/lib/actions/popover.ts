/**
 * `use:popover` - what every floating panel in the shell shares (History, the account popover, the
 * shortcuts help): Escape closes it, a pointer press outside closes it, focus moves inside when it
 * opens and returns to the trigger when it closes. `modal: true` also keeps Tab / Shift+Tab inside
 * (the shortcuts help; the Settings drawer runs the same `cycleTab` from its own key handler).
 *
 * The caller owns the `open` state: the action only asks to close through `onClose`. Put it on the
 * panel element inside `{#if open}` so it mounts with the panel and unmounts (returning focus) with it.
 */

export interface PopoverOptions {
  /** Asked to close; the caller flips its `open` flag. */
  onClose: () => void;
  /**
   * The control that opened the panel: focus returns to it on close and a press on it is never an
   * "outside" press (its own click handler toggles). Defaults to the element focused when the panel
   * mounted, which after a mouse or keyboard activation is that control.
   */
  trigger?: HTMLElement | null;
  /** Selector for the control to focus on open. Default: the first focusable, then the panel itself. */
  initialFocus?: string;
  /** Tab and Shift+Tab cycle inside the panel. */
  modal?: boolean;
}

/** What Tab reaches. Kept identical to what the Settings drawer used before this helper existed. */
export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/**
 * Keeps Tab / Shift+Tab inside `root`: a Tab from outside or from the last control lands on the
 * first, a Shift+Tab from the first lands on the last. Returns true when it moved focus.
 */
export function cycleTab(event: KeyboardEvent, root: HTMLElement): boolean {
  if (event.key !== 'Tab') return false;
  const list = focusables(root);
  const first = list[0];
  const last = list[list.length - 1];
  if (!first || !last) return false;
  const active = document.activeElement;
  if (!root.contains(active)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

/**
 * The element focused when the panel mounts, or null when nothing is (focus on `<body>` / `<html>`,
 * e.g. the `?` key pressed on a fresh popup). `<body>` must never become the trigger: it is in every
 * `composedPath()`, so no press would ever count as "outside".
 */
function activeElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  // Duck-typed rather than `instanceof HTMLElement`: the node test environment has no DOM globals.
  return typeof (el as HTMLElement).focus === 'function' ? (el as HTMLElement) : null;
}

export function popover(node: HTMLElement, opts: PopoverOptions) {
  let o = opts;
  const opener = o.trigger ?? activeElement();
  const returnTarget = (): HTMLElement | null => o.trigger ?? opener;

  const focusIn = () => {
    const wanted = o.initialFocus ? node.querySelector<HTMLElement>(o.initialFocus) : null;
    const target = wanted ?? focusables(node)[0] ?? node;
    if (target === node && !node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    target.focus();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // No stopPropagation: a tooltip behind the panel hides on the same press (tooltip.ts).
      event.preventDefault();
      o.onClose();
      return;
    }
    if (o.modal) cycleTab(event, node);
  };

  const onPointerDown = (event: PointerEvent) => {
    const path = event.composedPath();
    if (path.includes(node)) return;
    const trigger = returnTarget();
    if (trigger && path.includes(trigger)) return;
    o.onClose();
  };

  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onPointerDown);
  focusIn();

  return {
    update(next: PopoverOptions) {
      o = next;
    },
    destroy() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
      // Focus goes back only when it was inside the panel or fell to <body> with it. A user who
      // pressed another control keeps that focus.
      const active = document.activeElement;
      const lost = active === null || active === document.body || node.contains(active);
      const trigger = returnTarget();
      if (lost && trigger && trigger.isConnected) trigger.focus();
    },
  };
}

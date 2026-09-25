import { arrow, autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

/**
 * `use:tooltip` - the one styled tooltip for every icon button, chip and score in the extension.
 * Same API and behaviour as the web app's `src/lib/actions/tooltip.ts`; keep the two identical.
 *
 * One shared `role="tooltip"` element (`.ms-tooltip`, see `src/routes/app.css`) is appended to the
 * document body on first use and reused by every trigger, so at most one tooltip is ever on screen.
 * Hover shows it after `delay` ms, keyboard focus shows it at once; leaving, blurring, Escape or
 * pressing the trigger hides it. While it is visible the trigger's `aria-describedby` points at it.
 */

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipOptions {
  text: string;
  placement?: TooltipPlacement;
  delay?: number;
}

export interface ResolvedTooltipOptions {
  text: string;
  placement: TooltipPlacement;
  delay: number;
}

export const TOOLTIP_ID = 'ms-tooltip';
export const TOOLTIP_DELAY = 350;

const PLACEMENTS: readonly TooltipPlacement[] = ['top', 'bottom', 'left', 'right'];

/** String shorthand, defaults, and junk values (NaN / negative delay, unknown placement) made safe. */
export function normalizeTooltipOptions(opts: string | TooltipOptions | null | undefined): ResolvedTooltipOptions {
  if (typeof opts === 'string') return { text: opts.trim(), placement: 'top', delay: TOOLTIP_DELAY };
  if (!opts) return { text: '', placement: 'top', delay: TOOLTIP_DELAY };
  const text = typeof opts.text === 'string' ? opts.text.trim() : '';
  const placement = opts.placement && PLACEMENTS.includes(opts.placement) ? opts.placement : 'top';
  const delay = typeof opts.delay === 'number' && Number.isFinite(opts.delay) && opts.delay >= 0 ? opts.delay : TOOLTIP_DELAY;
  return { text, placement, delay };
}

/** Adds or removes one id in a space-separated `aria-describedby`, keeping any ids already there. */
export function withDescribedBy(current: string | null, id: string, present: boolean): string | null {
  const ids = (current ?? '').split(/\s+/).filter((t) => t !== '' && t !== id);
  if (present) ids.push(id);
  return ids.length > 0 ? ids.join(' ') : null;
}

/** True when the tooltip text only repeats the trigger's `aria-label` (compared trimmed, case-blind). */
export function repeatsName(node: Pick<HTMLElement, 'getAttribute'>, text: string): boolean {
  const name = node.getAttribute('aria-label');
  return name !== null && name.trim().toLowerCase() === text.trim().toLowerCase();
}

interface Tip {
  root: HTMLDivElement;
  label: HTMLSpanElement;
  arrow: HTMLDivElement;
}

let tip: Tip | null = null;
let owner: HTMLElement | null = null;
let stopAutoUpdate: (() => void) | null = null;
/** The one hover delay in flight. A nested trigger (History chip inside its row) cancels its parent's. */
let cancelPending: (() => void) | null = null;

function ensureTip(): Tip | null {
  if (typeof document === 'undefined' || !document.body) return null;
  if (tip && tip.root.isConnected) return tip;
  const root = document.createElement('div');
  root.id = TOOLTIP_ID;
  root.className = 'ms-tooltip';
  root.setAttribute('role', 'tooltip');
  const label = document.createElement('span');
  const arrowEl = document.createElement('div');
  arrowEl.className = 'ms-tooltip-arrow';
  root.append(label, arrowEl);
  document.body.appendChild(root);
  tip = { root, label, arrow: arrowEl };
  return tip;
}

const OPPOSITE: Record<TooltipPlacement, TooltipPlacement> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function position(node: HTMLElement, t: Tip, placement: TooltipPlacement): void {
  void computePosition(node, t.root, {
    placement,
    strategy: 'fixed',
    middleware: [offset(8), flip(), shift({ padding: 8 }), arrow({ element: t.arrow })],
  }).then(({ x, y, placement: final, middlewareData }) => {
    if (owner !== node) return;
    t.root.style.left = `${x}px`;
    t.root.style.top = `${y}px`;
    const side = (final.split('-')[0] ?? 'top') as TooltipPlacement;
    const a = middlewareData.arrow;
    Object.assign(t.arrow.style, {
      left: a?.x != null ? `${a.x}px` : '',
      top: a?.y != null ? `${a.y}px` : '',
      right: '',
      bottom: '',
      [OPPOSITE[side]]: '-4px',
    });
    t.root.dataset['placement'] = side;
    t.root.setAttribute('data-show', '');
  });
}

function onWindowKey(event: KeyboardEvent): void {
  // Hide only: no preventDefault / stopPropagation, so Escape still reaches the Settings drawer,
  // the History dropdown and every other Escape handler behind the tooltip.
  if (event.key === 'Escape' && owner) hide(owner);
}

function show(node: HTMLElement, o: ResolvedTooltipOptions): void {
  if (o.text === '') return;
  const t = ensureTip();
  if (!t) return;
  if (owner && owner !== node) hide(owner);
  stopAutoUpdate?.();
  owner = node;
  t.label.textContent = o.text;
  // Text that repeats the accessible name would be read twice ("History, button, History").
  if (!repeatsName(node, o.text)) {
    node.setAttribute('aria-describedby', withDescribedBy(node.getAttribute('aria-describedby'), TOOLTIP_ID, true) ?? TOOLTIP_ID);
  }
  stopAutoUpdate = autoUpdate(node, t.root, () => position(node, t, o.placement));
  window.addEventListener('keydown', onWindowKey);
}

function hide(node: HTMLElement): void {
  if (owner !== node) return;
  owner = null;
  stopAutoUpdate?.();
  stopAutoUpdate = null;
  tip?.root.removeAttribute('data-show');
  const next = withDescribedBy(node.getAttribute('aria-describedby'), TOOLTIP_ID, false);
  if (next === null) node.removeAttribute('aria-describedby');
  else node.setAttribute('aria-describedby', next);
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onWindowKey);
}

/** A mouse click also focuses the button; only a keyboard-style focus should show the tooltip. */
function focusVisible(node: HTMLElement): boolean {
  try {
    return node.matches(':focus-visible');
  } catch {
    return true;
  }
}

export function tooltip(node: HTMLElement, opts: string | TooltipOptions) {
  let o = normalizeTooltipOptions(opts);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (cancelPending === clear) cancelPending = null;
  };
  const onEnter = (event: Event) => {
    // A tap sends pointerenter too; a tooltip left behind by a finger has no leave to close it.
    if ((event as PointerEvent).pointerType === 'touch' || o.text === '') return;
    clear();
    cancelPending?.();
    cancelPending = clear;
    timer = setTimeout(() => {
      timer = null;
      if (cancelPending === clear) cancelPending = null;
      show(node, o);
    }, o.delay);
  };
  const onLeave = () => {
    clear();
    hide(node);
  };
  const onFocus = () => {
    if (o.text === '' || !focusVisible(node)) return;
    clear();
    show(node, o);
  };
  const onKey = (event: Event) => {
    if ((event as KeyboardEvent).key === 'Escape') onLeave();
  };

  node.addEventListener('pointerenter', onEnter);
  node.addEventListener('pointerleave', onLeave);
  node.addEventListener('focus', onFocus);
  node.addEventListener('blur', onLeave);
  node.addEventListener('keydown', onKey);
  node.addEventListener('pointerdown', onLeave);

  return {
    update(next: string | TooltipOptions) {
      o = normalizeTooltipOptions(next);
      if (owner !== node) return;
      if (o.text === '') {
        onLeave();
        return;
      }
      // Visible right now (e.g. the theme button's label flipped): swap the text and re-anchor.
      show(node, o);
    },
    destroy() {
      clear();
      hide(node);
      node.removeEventListener('pointerenter', onEnter);
      node.removeEventListener('pointerleave', onLeave);
      node.removeEventListener('focus', onFocus);
      node.removeEventListener('blur', onLeave);
      node.removeEventListener('keydown', onKey);
      node.removeEventListener('pointerdown', onLeave);
    },
  };
}

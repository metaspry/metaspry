/**
 * `prefers-reduced-motion` for the shell's Svelte transitions. CSS transitions are gated in
 * `src/routes/app.css`; every `fly` / `fade` / `scale` call (Settings drawer, History and account
 * popovers, shortcuts help, toasts) takes `dur(ms)` so a user who asked for less motion gets none.
 */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** `ms`, or 0 when the user prefers reduced motion (Svelte skips a 0 ms transition outright). */
export function dur(ms: number): number {
  return reducedMotion() ? 0 : ms;
}

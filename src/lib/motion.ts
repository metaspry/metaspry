/**
 * `prefers-reduced-motion` for the shell's Svelte transitions: every `fly` / `fade` / `scale` call
 * (Settings drawer and its overlay, History panel, shortcuts help and its overlay, toasts) takes
 * `dur(ms)`. The CSS half lives in `src/routes/app.css`: under reduce, every CSS transition and
 * keyframe animation (spinners, skeleton pulse, ring sweep, colour fades) has 0 duration, and the
 * movement utilities (hover lift, press scale, ring sweep) are `motion-safe:` where they are used.
 */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** `ms`, or 0 when the user prefers reduced motion (Svelte skips a 0 ms transition outright). */
export function dur(ms: number): number {
  return reducedMotion() ? 0 : ms;
}

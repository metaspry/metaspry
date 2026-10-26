// Moved to src/lib/toast.ts (the store is not UI; lib modules import it). Kept only so a parallel
// branch's cloud/settings.ts compiles until it imports '../toast'; delete then (AGENTS.md 3.17).
export * from '../../toast';

/**
 * What a close request does in the Settings drawer (UX review 2026-10-25, Medium 19). A backdrop
 * click, Esc or the close button used to discard a half-edited form silently.
 *
 * - no unsaved edits: close
 * - unsaved edits, no question shown: ask ("Keep editing" / "Discard changes")
 * - the question is showing and Esc is pressed: keep editing (Esc never discards work)
 * - the question is showing and the backdrop or close button is pressed again: ask again (stay)
 */
export type CloseIntent = 'close' | 'confirm' | 'keep-editing';

export function closeIntent(dirty: boolean, confirming: boolean, via: 'escape' | 'backdrop' | 'button'): CloseIntent {
  if (!dirty) return 'close';
  if (confirming && via === 'escape') return 'keep-editing';
  return 'confirm';
}

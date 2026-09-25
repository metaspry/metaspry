<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { helpOpen } from './keyboard';
  import { shortcutsEnabled } from '../../storage/shortcuts';
  import { popover } from '../../actions/popover';
  import { FOCUS_RING } from '../toolbar';
  import { dur } from '../../motion';

  const TITLE_ID = 'shortcuts-help-title';

  function close() {
    helpOpen.set(false);
  }

  // `single`: a single-key shortcut that Settings > Preferences can turn off (WCAG 2.1.4).
  const rows: { key: string; label: string; single: boolean }[] = [
    { key: '/', label: 'Focus search', single: true },
    { key: '1 – 6', label: 'Switch to Tags / Previews / Audit / Site / AI / Compare', single: true },
    { key: 'r', label: 'Re-scan current page', single: true },
    { key: '?', label: 'Toggle this help', single: false },
    { key: 'Esc', label: 'Close drawers and modals', single: false },
  ];
</script>

{#if $helpOpen}
  <!-- A modal dialog: `use:popover` moves focus in, cycles Tab inside, closes on Escape or a press on
       the overlay, and returns focus to the `?` button (or wherever the `?` key was pressed). -->
  <div transition:fade={{ duration: dur(120) }} class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" role="presentation">
    <div
      use:popover={{ onClose: close, modal: true }}
      transition:scale={{ duration: dur(160), start: 0.96 }}
      class="w-full max-w-sm rounded-2xl border border-white/40 bg-white/95 p-4 shadow-2xl dark:border-white/10 dark:bg-popover/95"
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
    >
      <header class="mb-3 flex items-center justify-between">
        <h3 id={TITLE_ID} class="text-base font-semibold text-slate-900 dark:text-slate-50">Keyboard shortcuts</h3>
        <button type="button" on:click={close} aria-label="Close" class="flex h-7 w-7 items-center justify-center rounded-lg ms-muted hover:bg-white/60 dark:hover:bg-white/10 {FOCUS_RING}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>
      {#if !$shortcutsEnabled}
        <p class="mb-3 rounded-xl border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-200" role="note">
          Single-key shortcuts are off. Only <kbd class="font-mono font-semibold">?</kbd> and <kbd class="font-mono font-semibold">Esc</kbd> work. Turn them on in Settings &gt; Preferences.
        </p>
      {/if}
      <ul class="flex flex-col gap-1.5">
        {#each rows as r}
          <li class="flex items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/40 px-3 py-1.5 text-xs dark:border-white/10 dark:bg-white/5">
            <span class="text-slate-700 dark:text-slate-300">{r.label}{#if r.single && !$shortcutsEnabled}<span class="ms-muted"> (off)</span>{/if}</span>
            <kbd class="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-semibold text-white dark:bg-slate-50 dark:text-slate-900">{r.key}</kbd>
          </li>
        {/each}
      </ul>
      <p class="ms-muted mt-3 text-[11px]">Single-key shortcuts can be turned off in Settings &gt; Preferences.</p>
    </div>
  </div>
{/if}

<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { helpOpen } from './keyboard';

  function close() {
    helpOpen.set(false);
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
  }

  const rows: { key: string; label: string }[] = [
    { key: '/', label: 'Focus search' },
    { key: '1 / 2 / 3 / 4', label: 'Switch to Tags / Previews / Audit / Compare' },
    { key: 'r', label: 'Re-scrape current page' },
    { key: '?', label: 'Toggle this help' },
    { key: 'Esc', label: 'Close drawers and modals' },
  ];
</script>

<svelte:window on:keydown={onKey} />

{#if $helpOpen}
  <div transition:fade={{ duration: 120 }} class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" on:click={close} role="presentation">
    <div
      transition:scale={{ duration: 160, start: 0.96 }}
      class="w-full max-w-sm rounded-2xl border border-white/40 bg-white/95 p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900/95"
      role="dialog"
      aria-label="Keyboard shortcuts"
      on:click|stopPropagation
    >
      <header class="mb-3 flex items-center justify-between">
        <h3 class="text-base font-semibold text-slate-900 dark:text-slate-50">Keyboard shortcuts</h3>
        <button type="button" on:click={close} aria-label="Close" class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-white/10">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>
      <ul class="flex flex-col gap-1.5">
        {#each rows as r}
          <li class="flex items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/40 px-3 py-1.5 text-xs dark:border-white/10 dark:bg-white/5">
            <span class="text-slate-700 dark:text-slate-300">{r.label}</span>
            <kbd class="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-semibold text-white dark:bg-slate-50 dark:text-slate-900">{r.key}</kbd>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

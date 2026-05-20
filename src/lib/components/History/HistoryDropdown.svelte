<script lang="ts">
  import { fade } from 'svelte/transition';
  import { history, clearHistory } from '../../storage/history';

  let open = false;

  function rel(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function bandColor(score: number): string {
    if (score >= 80) return 'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
    if (score >= 50) return 'bg-amber-500/20 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
    return 'bg-rose-500/20 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300';
  }

  function openInNewTab(url: string) {
    chrome.tabs.create({ url });
  }

  function onWindowClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('[data-history-root]')) open = false;
  }
</script>

<svelte:window on:click={onWindowClick} />

<div class="relative" data-history-root>
  <button
    type="button"
    aria-label="History"
    on:click={() => (open = !open)}
    class="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/40 text-slate-700 backdrop-blur-md transition hover:bg-white/70 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-indigo-300"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  </button>
  {#if open}
    <div
      transition:fade={{ duration: 100 }}
      class="absolute right-0 top-10 z-30 w-72 overflow-hidden rounded-2xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90"
    >
      <header class="flex items-center justify-between border-b border-white/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
        <span>Recent scrapes</span>
        {#if $history.length > 0}
          <button type="button" on:click={clearHistory} class="text-rose-500 hover:underline dark:text-rose-400">Clear</button>
        {/if}
      </header>
      {#if $history.length === 0}
        <p class="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">No history yet.</p>
      {:else}
        <ul class="max-h-72 overflow-y-auto">
          {#each $history as entry (entry.timestamp)}
            <li class="border-b border-white/40 last:border-b-0 dark:border-white/5">
              <button
                type="button"
                on:click={() => openInNewTab(entry.url)}
                class="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/60 dark:hover:bg-white/5"
              >
                <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums {bandColor(entry.score)}">{entry.score}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-medium text-slate-900 dark:text-slate-50">{entry.title || entry.hostname}</span>
                  <span class="block truncate text-[10px] text-slate-500 dark:text-slate-400">{entry.hostname}</span>
                </span>
                <span class="text-[10px] text-slate-400 dark:text-slate-500">{rel(entry.timestamp)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

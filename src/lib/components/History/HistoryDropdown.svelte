<script lang="ts">
  import { timeAgo } from '../../util/time-ago';
  import { fade } from 'svelte/transition';
  import { history, clearHistory } from '../../storage/history';
  import SiteIcon from '../SiteIcon/SiteIcon.svelte';
  import { toolbarButtonClass } from '../toolbar';
  import { bandClasses, bandFor, scoreLabel } from '../../audit/band';
  import { tooltip } from '../../actions/tooltip';

  let open = false;

  function openInNewTab(url: string) {
    // active: false opens the new tab in the background so the popup retains
    // focus. Without it Chrome immediately closes the popup when the new tab
    // takes focus, leaving the user with an unaudited new page and no UI.
    chrome.tabs.create({ url, active: false });
  }

  function onWindowClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('[data-history-root]')) open = false;
  }
</script>

<svelte:window on:click={onWindowClick} />

<!-- Not `relative`: the menu anchors to the header's right-hand block (Extension.svelte). -->
<div data-history-root>
  <button
    type="button"
    aria-label="History"
    use:tooltip={'History'}
    aria-expanded={open}
    on:click={() => (open = !open)}
    class={toolbarButtonClass(open)}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  </button>
  {#if open}
    <div
      transition:fade={{ duration: 100 }}
      class="absolute right-0 top-10 z-30 w-64 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90"
    >
      <header class="flex items-center justify-between border-b border-white/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
        <span>Recent scrapes</span>
        {#if $history.length > 0}
          <button type="button" on:click={clearHistory} class="text-rose-500 hover:underline dark:text-rose-400">Clear</button>
        {/if}
      </header>
      {#if $history.length > 0}
        <p class="flex items-center gap-1 border-b border-white/40 px-3 py-1.5 text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" aria-hidden="true">
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
          Click to open in a new tab
        </p>
      {/if}
      {#if $history.length === 0}
        <p class="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">No history yet.</p>
      {:else}
        <ul class="max-h-72 overflow-y-auto">
          {#each $history as entry (entry.timestamp)}
            {@const label = scoreLabel(entry.score)}
            <li class="border-b border-white/40 last:border-b-0 dark:border-white/5">
              <button
                type="button"
                use:tooltip={'Open in new tab'}
                on:click={() => openInNewTab(entry.url)}
                class="group/row flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/60 dark:hover:bg-white/5"
              >
                <SiteIcon src={entry.icon ?? null} hostname={entry.hostname} size={16} />
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1">
                    <span class="truncate text-xs font-medium text-slate-900 dark:text-slate-50">{entry.title || entry.hostname}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                      class="h-3 w-3 flex-shrink-0 text-slate-400 opacity-0 transition group-hover/row:opacity-100 dark:text-slate-500"
                    >
                      <path d="M7 17 17 7M8 7h9v9" />
                    </svg>
                  </span>
                  <span class="block truncate text-[10px] text-slate-500 dark:text-slate-400">{entry.hostname}</span>
                </span>
                <span class="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{timeAgo(entry.timestamp)}</span>
                <!-- Verdict last, on the right: the same rule as every list in the web app. -->
                <span
                  role="img"
                  aria-label={label}
                  use:tooltip={label}
                  class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums {bandClasses(bandFor(entry.score)).chip}"
                >{Math.round(entry.score)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

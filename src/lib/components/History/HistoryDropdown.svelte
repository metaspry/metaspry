<script lang="ts">
  import { fade } from 'svelte/transition';
  import { tick } from 'svelte';
  import { history, clearHistory } from '../../storage/history';
  import SiteIcon from '../SiteIcon/SiteIcon.svelte';
  import { toolbarButtonClass, FOCUS_RING, FOCUS_RING_INSET } from '../toolbar';
  import { bandClasses, bandFor, scoreLabel } from '../../audit/band';
  import { tooltip } from '../../actions/tooltip';
  import { popover } from '../../actions/popover';
  import { dur } from '../../motion';
  import { timeAgo } from '../../util/time-ago';

  const TITLE_ID = 'history-title';
  const CONFIRM_CLASS = `rounded px-1 underline-offset-2 hover:underline ${FOCUS_RING}`;

  let open = false;
  let trigger: HTMLButtonElement | null = null;
  let panel: HTMLElement | null = null;
  let clearBtn: HTMLButtonElement | null = null;
  let confirmBtn: HTMLButtonElement | null = null;
  let confirmGroup: HTMLElement | null = null;
  // "Clear" is two steps: the button turns into "Clear all? Yes / No" and only Yes clears.
  let clearArmed = false;

  $: if (!open) clearArmed = false;

  function close() {
    open = false;
  }

  function openInNewTab(url: string) {
    // active: false opens the new tab in the background so the popup retains
    // focus. Without it Chrome immediately closes the popup when the new tab
    // takes focus, leaving the user with an unaudited new page and no UI.
    chrome.tabs.create({ url, active: false });
  }

  // Arming swaps the button for the confirm, so focus follows the swap (the Settings drawer's
  // Reset does the same) instead of falling to <body>.
  async function armClear() {
    clearArmed = true;
    await tick();
    confirmBtn?.focus();
  }
  async function disarmClear(refocus: boolean) {
    clearArmed = false;
    if (!refocus) return;
    await tick();
    clearBtn?.focus();
  }
  async function confirmClear() {
    clearArmed = false;
    clearHistory();
    // Clear leaves with the list, so focus stays on the panel rather than dropping to <body>.
    await tick();
    panel?.focus();
  }
  function onConfirmKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    // Cancels the confirm only; the panel stays open (a second Escape closes it).
    event.preventDefault();
    event.stopPropagation();
    void disarmClear(true);
  }
  function onConfirmFocusOut(event: FocusEvent) {
    const next = event.relatedTarget;
    if (next instanceof Node && confirmGroup?.contains(next)) return;
    clearArmed = false;
  }
</script>

<!-- Not `relative`: the menu anchors to the header's right-hand block (Extension.svelte). -->
<div>
  <button
    bind:this={trigger}
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
    <!-- `use:popover`: focus lands on the first row (the panel itself when there is none), Escape
         or a press outside closes, focus returns to the History button. -->
    <div
      bind:this={panel}
      use:popover={{ trigger, onClose: close, initialFocus: '[data-history-row]' }}
      transition:fade={{ duration: dur(100) }}
      role="dialog"
      aria-labelledby={TITLE_ID}
      tabindex="-1"
      class="absolute right-0 top-10 z-30 w-64 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-white/40 bg-white shadow-xl focus:outline-none dark:border-white/10 dark:bg-popover"
    >
 <header class="flex items-center justify-between border-b border-white/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ms-muted dark:border-white/10">
        <span id={TITLE_ID}>Recent scrapes</span>
        {#if $history.length > 0}
          {#if clearArmed}
            <span bind:this={confirmGroup} role="group" aria-label="Confirm clear history" class="inline-flex items-center gap-1.5 text-[11px] normal-case tracking-normal text-rose-600 dark:text-rose-300">
              Clear all?
              <button bind:this={confirmBtn} type="button" on:click={confirmClear} on:keydown={onConfirmKey} on:focusout={onConfirmFocusOut} class={CONFIRM_CLASS}>Yes</button>
              <span aria-hidden="true">/</span>
              <button type="button" on:click={() => disarmClear(true)} on:keydown={onConfirmKey} on:focusout={onConfirmFocusOut} class={CONFIRM_CLASS}>No</button>
            </span>
          {:else}
            <button bind:this={clearBtn} type="button" on:click={armClear} class="rounded px-1 text-[11px] normal-case tracking-normal text-rose-600 hover:underline dark:text-rose-300 {FOCUS_RING}">Clear</button>
          {/if}
        {/if}
      </header>
      {#if $history.length > 0}
 <p class="flex items-center gap-1 border-b border-white/40 px-3 py-1.5 text-[10px] ms-muted dark:border-white/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" aria-hidden="true">
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
          Click to open in a new tab
        </p>
      {/if}
      {#if $history.length === 0}
 <p class="px-3 py-4 text-center text-xs ms-muted">No history yet.</p>
      {:else}
        <ul class="max-h-72 overflow-y-auto">
          {#each $history as entry (entry.timestamp)}
            {@const label = scoreLabel(entry.score)}
            <li class="border-b border-white/40 last:border-b-0 dark:border-white/5">
              <button
                type="button"
                data-history-row
                use:tooltip={'Open in new tab'}
                on:click={() => openInNewTab(entry.url)}
                class="group/row flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/60 dark:hover:bg-white/5 {FOCUS_RING_INSET}"
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
 class="h-3 w-3 flex-shrink-0 ms-muted opacity-0 transition group-hover/row:opacity-100"
                    >
                      <path d="M7 17 17 7M8 7h9v9" />
                    </svg>
                  </span>
 <span class="block truncate text-[10px] ms-muted">{entry.hostname}</span>
                </span>
 <span class="shrink-0 text-[10px] ms-muted">{timeAgo(entry.timestamp)}</span>
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

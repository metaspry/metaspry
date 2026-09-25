<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { FOCUS_RING } from '../toolbar';

  /** Plain reason, from `describeScanError` or `unscriptableMessage`. */
  export let reason: string = 'Something went wrong while reading this page. Try again.';
  /** Raw error text, shown only behind "Details". */
  export let detail: string | null = null;

  const dispatch = createEventDispatcher<{ retry: void }>();

  let heading: HTMLHeadingElement | null = null;

  // This card only ever mounts after a failed scan, and the button that started the scan is gone:
  // focus moves to the heading (tabindex -1) instead of falling to <body> (R-34). The assertive
  // announcement lives in Extension.svelte.
  onMount(() => {
    heading?.focus();
  });
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    class="h-16 w-16 text-rose-500 dark:text-rose-400"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8 V13" />
    <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
  </svg>
  <h2 bind:this={heading} tabindex="-1" class="text-base font-semibold text-slate-900 focus:outline-none dark:text-slate-50">Couldn't scan this page</h2>
  <p class="max-w-xs break-words text-sm ms-muted">{reason}</p>
  <button
    type="button"
    on:click={() => dispatch('retry')}
    class="mt-2 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-500 active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-400 {FOCUS_RING}"
  >
    Retry
  </button>
  {#if detail}
    <details class="w-full max-w-xs text-left text-xs">
      <summary class="ms-muted mx-auto flex h-6 w-fit cursor-pointer items-center rounded px-1 font-medium hover:text-slate-900 dark:hover:text-slate-100 {FOCUS_RING}">Details</summary>
      <pre class="mt-2 whitespace-pre-wrap break-words rounded-lg border border-slate-300 bg-white/60 p-2 font-mono text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">{detail}</pre>
    </details>
  {/if}
  <p class="ms-muted mt-3 text-xs">
    Stuck?
    <a
      href="https://metaspry.com/docs/"
      target="_blank"
      rel="noopener noreferrer"
      class="rounded text-indigo-600 hover:underline dark:text-indigo-300 {FOCUS_RING}"
    >metaspry.com/docs</a>
    ·
    <a
      href="https://github.com/metaspry/metaspry/issues/new/choose"
      target="_blank"
      rel="noopener noreferrer"
      class="rounded text-indigo-600 hover:underline dark:text-indigo-300 {FOCUS_RING}"
    >Report a bug</a>
  </p>
</div>

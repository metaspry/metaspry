<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let message: string = 'Unknown error';

  const dispatch = createEventDispatcher<{ retry: void }>();
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
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8 V13" />
    <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
  </svg>
  <h3 class="text-base font-semibold text-slate-900 dark:text-slate-50">Couldn't scrape this page</h3>
  <p class="max-w-xs break-words text-sm text-slate-600 dark:text-slate-400">{message}</p>
  <button
    type="button"
    on:click={() => dispatch('retry')}
    class="mt-2 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-500 active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-400"
  >
    Retry
  </button>
</div>

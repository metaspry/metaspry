<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ retry: void }>();
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    class="h-28 w-28 text-indigo-400/70 dark:text-indigo-300/70"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="20" y="28" width="80" height="64" rx="10" class="opacity-60" />
    <path d="M20 44 H100" class="opacity-60" />
    <circle cx="30" cy="36" r="2" fill="currentColor" />
    <circle cx="38" cy="36" r="2" fill="currentColor" />
    <circle cx="46" cy="36" r="2" fill="currentColor" />
    <path d="M40 64 L60 64 M40 74 L80 74 M40 84 L70 84" class="opacity-40" />
    <circle cx="92" cy="92" r="14" />
    <path d="M88 92 L96 92" />
  </svg>
  <h3 class="text-base font-semibold text-slate-900 dark:text-slate-50">No meta tags found</h3>
  <p class="max-w-xs text-sm text-slate-600 dark:text-slate-400">
    This page has no Open Graph, Twitter, or standard meta tags to analyze.
  </p>
  <button
    type="button"
    on:click={() => dispatch('retry')}
    class="mt-2 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-500 active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-400"
  >
    Try again
  </button>
</div>

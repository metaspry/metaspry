<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CategoryFilter } from '../../scrapers/PageMeta';

  export let active: CategoryFilter = 'all';
  export let counts: Record<CategoryFilter, number>;

  const chips: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'og', label: 'Open Graph' },
    { id: 'twitter', label: 'Twitter' },
    { id: 'seo', label: 'SEO' },
    { id: 'basic', label: 'Basic' },
    { id: 'other', label: 'Other' },
  ];

  const dispatch = createEventDispatcher<{ change: CategoryFilter }>();

  function select(id: CategoryFilter) {
    if (id !== active) dispatch('change', id);
  }
</script>

<div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
  {#each chips as chip}
    {@const count = counts[chip.id] ?? 0}
    <button
      type="button"
      aria-pressed={chip.id === active}
      on:click={() => select(chip.id)}
      class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition {chip.id === active
        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
        : 'border border-white/40 bg-white/40 text-slate-700 backdrop-blur-md hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'}"
    >
      <span>{chip.label}</span>
      <span class="tabular-nums opacity-80">{count}</span>
    </button>
  {/each}
</div>

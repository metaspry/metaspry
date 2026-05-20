<script lang="ts">
  import type { CategoryFilter, MetaTag, PageMeta } from '../../scrapers/PageMeta';
  import TagCard from '../Card/TagCard.svelte';
  import SearchInput from './SearchInput.svelte';
  import CategoryChips from './CategoryChips.svelte';
  import ExportBar from '../Exporters/ExportBar.svelte';
  import { pinned, isPinned } from '../../storage/pinned';

  export let meta: PageMeta;

  let search = '';
  let active: CategoryFilter = 'all';

  function syntheticTags(m: PageMeta): MetaTag[] {
    const out: MetaTag[] = [];
    if (m.title) out.push({ key: 'title', value: m.title, source: 'title', category: 'basic' });
    if (m.canonical) out.push({ key: 'canonical', value: m.canonical, source: 'link', category: 'seo' });
    if (m.icon) out.push({ key: 'icon', value: m.icon, source: 'link', category: 'basic' });
    return out;
  }

  $: allTags = [...syntheticTags(meta), ...meta.tags];

  $: searchLower = search.trim().toLowerCase();

  $: searchFiltered = searchLower
    ? allTags.filter(
        (t) =>
          t.key.toLowerCase().includes(searchLower) ||
          t.value.toLowerCase().includes(searchLower)
      )
    : allTags;

  $: counts = {
    all: searchFiltered.length,
    og: searchFiltered.filter((t) => t.category === 'og').length,
    twitter: searchFiltered.filter((t) => t.category === 'twitter').length,
    seo: searchFiltered.filter((t) => t.category === 'seo').length,
    basic: searchFiltered.filter((t) => t.category === 'basic').length,
    other: searchFiltered.filter((t) => t.category === 'other').length,
  } satisfies Record<CategoryFilter, number>;

  $: filteredByCat =
    active === 'all'
      ? searchFiltered
      : searchFiltered.filter((t) => t.category === active);

  $: visible = (() => {
    const pinnedSet = $pinned;
    const pinnedTags = filteredByCat.filter((t) => isPinned(pinnedSet, t.key));
    const restTags = filteredByCat.filter((t) => !isPinned(pinnedSet, t.key));
    return [...pinnedTags, ...restTags];
  })();
</script>

<div class="flex flex-col gap-3">
  <SearchInput bind:value={search} />
  <CategoryChips {active} {counts} on:change={(e) => (active = e.detail)} />
  <ExportBar {meta} />
  {#if visible.length === 0}
    <p class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
      No matches for current filter.
    </p>
  {:else}
    <div class="flex flex-wrap gap-3">
      {#each visible as tag (tag.source + ':' + tag.key + ':' + tag.value)}
        <TagCard {tag} />
      {/each}
    </div>
  {/if}
</div>

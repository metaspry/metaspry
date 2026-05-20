<script lang="ts">
  import type { MetaTag } from '../../scrapers/PageMeta';

  export let tags: MetaTag[];

  $: dupKeys = (() => {
    const counts = new Map<string, MetaTag[]>();
    for (const t of tags) {
      const k = t.key.toLowerCase();
      const list = counts.get(k);
      if (list) list.push(t);
      else counts.set(k, [t]);
    }
    return Array.from(counts.entries()).filter(([, list]) => list.length > 1);
  })();
</script>

{#if dupKeys.length > 0}
  <section class="flex flex-col gap-2">
    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Duplicate keys ({dupKeys.length})</h4>
    <div class="flex flex-col gap-1">
      {#each dupKeys as [key, list]}
        <div class="rounded-xl border border-amber-300/60 bg-amber-50/60 px-3 py-1.5 text-xs dark:border-amber-500/30 dark:bg-amber-950/40">
          <span class="font-medium text-amber-800 dark:text-amber-300">{key}</span>
          <span class="text-amber-700 dark:text-amber-400"> × {list.length}</span>
        </div>
      {/each}
    </div>
  </section>
{/if}

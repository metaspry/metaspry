<script lang="ts">
  import type { HreflangEntry } from '../../scrapers/getHreflang';

  export let hreflang: HreflangEntry[];
</script>

{#if hreflang.length > 0}
  <section class="flex flex-col gap-2">
    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">hreflang ({hreflang.length})</h4>
    <div class="flex flex-col gap-1">
      {#each hreflang as h, i (i)}
        <div class="flex items-center gap-2 rounded-xl border border-white/40 bg-white/40 px-3 py-1.5 text-xs backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <span class="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{h.hreflang}</span>
          <span class="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300" title={h.href}>{h.href}</span>
        </div>
      {/each}
    </div>
  </section>
{/if}

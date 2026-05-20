<script lang="ts">
  import type { JsonLdResult } from '../../scrapers/getJsonLd';

  export let jsonLd: JsonLdResult;

  function preview(data: Record<string, unknown>): string {
    const keys = Object.keys(data).filter((k) => k !== '@context' && k !== '@type');
    return keys.slice(0, 4).join(', ') || '—';
  }
</script>

{#if jsonLd.entities.length > 0 || jsonLd.parseErrors > 0}
  <section class="flex flex-col gap-2">
    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Structured Data (JSON-LD)</h4>
    {#if jsonLd.parseErrors > 0}
      <div class="rounded-xl border border-rose-300/60 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">
        {jsonLd.parseErrors} JSON-LD block(s) failed to parse.
      </div>
    {/if}
    {#each jsonLd.entities as entity, i (i)}
      <div class="rounded-xl border border-white/40 bg-white/40 px-3 py-2 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
        <p class="text-sm font-semibold text-slate-900 dark:text-slate-50">{entity.type}</p>
        <p class="break-all text-xs text-slate-600 dark:text-slate-400">{preview(entity.data)}</p>
      </div>
    {/each}
  </section>
{/if}

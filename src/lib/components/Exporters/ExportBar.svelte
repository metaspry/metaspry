<script lang="ts">
  import type { PageMeta } from '../../scrapers/PageMeta';
  import { toJson, toCsv, download } from '../../exporters/exporters';
  import { toast } from '../Toast/toast';

  export let meta: PageMeta;

  function copyText(text: string, what: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast(`${what} copied to clipboard`, 'success');
    });
  }

  function safeName(): string {
    const host = (() => {
      try {
        return new URL(meta.canonical ?? '').hostname || 'meta';
      } catch {
        return 'meta';
      }
    })();
    return host.replace(/[^a-z0-9.-]+/gi, '_');
  }
</script>

<div class="flex flex-wrap items-center gap-1.5">
  <button
    type="button"
    on:click={() => copyText(toJson(meta), 'JSON')}
    class="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
  >Copy JSON</button>
  <button
    type="button"
    on:click={() => copyText(toCsv(meta), 'CSV')}
    class="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
  >Copy CSV</button>
  <button
    type="button"
    on:click={() => download(`${safeName()}.json`, toJson(meta), 'application/json')}
    class="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
  >Download .json</button>
  <button
    type="button"
    on:click={() => download(`${safeName()}.csv`, toCsv(meta), 'text/csv')}
    class="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
  >Download .csv</button>
</div>

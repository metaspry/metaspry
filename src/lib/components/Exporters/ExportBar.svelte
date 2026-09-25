<script lang="ts">
  import type { PageMeta } from '../../scrapers/PageMeta';
  import { toJson, toCsv, download } from '../../exporters/exporters';
  import { toast } from '../Toast/toast';
  import { tooltip } from '../../actions/tooltip';

  export let meta: PageMeta;

  function copyText(text: string, what: string) {
    // Without the catch a blocked or failed clipboard write showed nothing at all: no toast, no
    // error, and the user believed they had copied.
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast(`${what} copied to clipboard`, 'success');
      })
      .catch(() => {
        toast(`Could not copy ${what.toLowerCase()} — your browser blocked clipboard access`, 'error');
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
    use:tooltip={'Copy every tag on this page as JSON'}
    class="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
  >Copy JSON</button>
  <button
    type="button"
    on:click={() => copyText(toCsv(meta), 'CSV')}
    use:tooltip={'Copy every tag on this page as CSV'}
    class="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
  >Copy CSV</button>
  <button
    type="button"
    on:click={() => download(`${safeName()}.json`, toJson(meta), 'application/json')}
    use:tooltip={'Save every tag on this page as a .json file'}
    class="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
  >Download .json</button>
  <button
    type="button"
    on:click={() => download(`${safeName()}.csv`, toCsv(meta), 'text/csv')}
    use:tooltip={'Save every tag on this page as a .csv file'}
    class="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
  >Download .csv</button>
</div>

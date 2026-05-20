<script lang="ts">
  import type { PageMeta } from '../../scrapers/PageMeta';
  import { getMetaTags } from '../../scrapers/getMetaTags';
  import { audit } from '../../audit/rules';
  import { resolveAsyncRules } from '../../audit/asyncRules';
  import { settings } from '../../storage/settings';
  import { diffMeta, type DiffRow } from './diff';

  export let leftMeta: PageMeta;
  export let leftUrl: string;
  export let leftScore: number = 0;

  let url = '';
  let loading = false;
  let errorMessage = '';
  let rightMeta: PageMeta | null = null;
  let rightUrl = '';
  let rows: DiffRow[] = [];
  let rightScore = 0;

  async function compare() {
    if (!url.trim()) return;
    loading = true;
    errorMessage = '';
    rightMeta = null;
    rows = [];
    try {
      const target = url.trim();
      const res = await fetch(target, { credentials: 'omit', redirect: 'follow' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.toLowerCase().includes('text/html')) {
        throw new Error(`Not an HTML page (content-type: ${ct || 'unknown'}).`);
      }
      const text = await res.text();
      const finalUrl = res.url || target;
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const meta = getMetaTags(doc.documentElement, finalUrl);
      rightMeta = meta;
      rightUrl = finalUrl;
      rows = diffMeta(leftMeta, meta);
      const initial = audit(meta, $settings);
      rightScore = initial.score;
      if (initial.hasPending) {
        const resolved = await resolveAsyncRules(initial, meta, $settings);
        rightScore = resolved.score;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function statusColor(s: DiffRow['status']): string {
    if (s === 'same') return 'border-emerald-300/40 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-950/30';
    if (s === 'different') return 'border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/40';
    return 'border-slate-200/60 bg-slate-50/40 dark:border-slate-700/40 dark:bg-slate-900/20';
  }

  function scoreColor(s: number): string {
    if (s >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (s >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  }
</script>

<div class="flex flex-col gap-3">
  <form on:submit|preventDefault={compare} class="flex gap-2">
    <input
      type="url"
      required
      placeholder="https://example.com"
      bind:value={url}
      class="flex-1 rounded-full border border-white/40 bg-white/40 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 backdrop-blur-md focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
    />
    <button
      type="submit"
      disabled={loading}
      class="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-500 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >{loading ? '…' : 'Compare'}</button>
  </form>

  {#if errorMessage}
    <p class="rounded-xl border border-rose-300/60 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">{errorMessage}</p>
  {/if}

  {#if rightMeta}
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-xl border border-white/40 bg-white/40 px-3 py-2 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Current</p>
        <p class="truncate text-xs text-slate-700 dark:text-slate-300" title={leftUrl}>{leftUrl}</p>
        <p class="text-lg font-bold tabular-nums {scoreColor(leftScore)}">{leftScore}</p>
      </div>
      <div class="rounded-xl border border-white/40 bg-white/40 px-3 py-2 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Compared</p>
        <p class="truncate text-xs text-slate-700 dark:text-slate-300" title={rightUrl}>{rightUrl}</p>
        <p class="text-lg font-bold tabular-nums {scoreColor(rightScore)}">{rightScore}</p>
      </div>
    </div>

    <div class="flex flex-col gap-1">
      {#each rows as row (row.key)}
        <div class="rounded-xl border px-3 py-2 text-xs {statusColor(row.status)}">
          <p class="font-semibold text-slate-900 dark:text-slate-50">{row.key}</p>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <p class="break-all text-slate-700 dark:text-slate-300">{row.left ?? '—'}</p>
            <p class="break-all text-slate-700 dark:text-slate-300">{row.right ?? '—'}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

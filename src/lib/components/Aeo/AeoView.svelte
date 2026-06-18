<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchSiteFiles } from '../../scrapers/getSiteFiles';
  import type { SiteFiles } from '../../scrapers/SiteFiles';
  import { analyzeAeo, type AeoResult, type AeoState } from '../../audit/aeo';

  export let html: HTMLElement | null;
  export let baseUrl: string;

  let loading = true;
  let errorMessage = '';
  let result: AeoResult | null = null;

  const dot: Record<AeoState, string> = {
    pass: 'bg-emerald-500',
    warn: 'bg-amber-500',
    fail: 'bg-rose-500',
    info: 'bg-slate-400',
  };
  const stateLabel: Record<AeoState, string> = {
    pass: 'Pass',
    warn: 'Needs work',
    fail: 'Fail',
    info: 'Info',
  };

  async function load() {
    if (!html) {
      loading = false;
      errorMessage = 'Scan a page first.';
      return;
    }
    loading = true;
    errorMessage = '';
    let siteFiles: SiteFiles | null = null;
    try {
      siteFiles = baseUrl ? await fetchSiteFiles(baseUrl) : null;
    } catch {
      siteFiles = null; // site checks just get skipped
    }
    try {
      result = analyzeAeo(html, siteFiles, baseUrl);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  $: pageChecks = result?.checks.filter((c) => c.scope === 'page') ?? [];
  $: siteChecks = result?.checks.filter((c) => c.scope === 'site') ?? [];
</script>

<div class="flex flex-col gap-3">
  {#if loading}
    <div class="flex items-center gap-2 rounded-2xl border border-white/40 bg-white/40 px-3 py-2 text-xs text-slate-600 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-4 w-4 animate-spin">
        <path d="M21 12a9 9 0 1 1-6.2-8.5" />
      </svg>
      Checking AI readiness…
    </div>
  {:else if errorMessage}
    <p class="rounded-xl border border-rose-300/60 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">{errorMessage}</p>
  {:else if result}
    <div class="flex items-center gap-2">
      <span
        class="rounded-full px-2.5 py-0.5 text-xs font-semibold {result.chip === 'ready'
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}"
      >
        {result.chip === 'ready' ? 'AI-ready' : 'Needs work'}
      </span>
      <span class="text-[11px] text-slate-500 dark:text-slate-400">Readiness for AI answer engines - not a guarantee of citations.</span>
    </div>

    {#each [{ title: 'Page', items: pageChecks }, { title: 'Site', items: siteChecks }] as group (group.title)}
      {#if group.items.length}
        <div class="flex flex-col gap-2">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{group.title}</p>
          {#each group.items as c (c.id)}
            <div class="flex items-start gap-2.5 rounded-2xl border border-white/40 bg-white/40 px-3 py-2 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
              <span class="mt-1 h-2 w-2 shrink-0 rounded-full {dot[c.state]}" aria-hidden="true"></span>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
                  <span class="text-[9px] uppercase tracking-wide text-slate-400">{stateLabel[c.state]}</span>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">{c.detail}</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  {/if}
</div>

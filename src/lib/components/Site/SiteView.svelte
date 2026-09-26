<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchSiteFiles } from '../../scrapers/getSiteFiles';
  import type { SiteFiles } from '../../scrapers/SiteFiles';
  import RobotsCard from './RobotsCard.svelte';
  import SitemapCard from './SitemapCard.svelte';
  import LlmsCard from './LlmsCard.svelte';

  export let baseUrl: string;

  let loading = true;
  let data: SiteFiles | null = null;
  let errorMessage = '';

  async function load() {
    if (!baseUrl) {
      loading = false;
      errorMessage = 'No page URL to derive host from.';
      return;
    }
    loading = true;
    errorMessage = '';
    try {
      data = await fetchSiteFiles(baseUrl);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<div class="flex flex-col gap-3">
  {#if loading}
    <div class="flex items-center gap-2 rounded-2xl border border-white/40 bg-white/40 px-3 py-2 text-xs text-slate-600 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-4 w-4 animate-spin">
        <path d="M21 12a9 9 0 1 1-6.2-8.5" />
      </svg>
      Fetching robots.txt, sitemap.xml, llms.txt…
    </div>
  {:else if errorMessage}
    <p class="rounded-xl border border-rose-300/60 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">{errorMessage}</p>
  {:else if data}
    <RobotsCard robots={data.robots} />
    <SitemapCard sitemap={data.sitemap} />
    <LlmsCard llms={data.llms} />
  {/if}
</div>

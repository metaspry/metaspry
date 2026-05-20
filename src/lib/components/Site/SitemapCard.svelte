<script lang="ts">
  import type { SitemapInfo } from '../../scrapers/SiteFiles';

  export let sitemap: SitemapInfo;

  let showChildren = false;
</script>

<section class="overflow-hidden rounded-2xl border border-white/40 bg-white/50 shadow-md shadow-indigo-500/5 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
  <header class="flex items-center justify-between border-b border-white/40 px-4 py-2 dark:border-white/10">
    <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-50">sitemap.xml</h4>
    {#if sitemap.present}
      <span class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Found</span>
    {:else}
      <span class="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">Missing</span>
    {/if}
  </header>
  <div class="space-y-2 px-4 py-3 text-xs">
    {#if sitemap.present}
      {#if sitemap.isIndex}
        <p class="text-slate-700 dark:text-slate-300">
          Sitemap index · {sitemap.childCount} child sitemap{sitemap.childCount === 1 ? '' : 's'}
          {#if sitemap.truncated}<span class="text-amber-600 dark:text-amber-400"> (showing first 20)</span>{/if}
          · ~{sitemap.urlCount} total URL{sitemap.urlCount === 1 ? '' : 's'}
        </p>
        {#if sitemap.children.length > 0}
          <div class="space-y-1">
            <button type="button" on:click={() => (showChildren = !showChildren)} class="text-[10px] font-medium text-indigo-600 hover:underline dark:text-indigo-300">
              {showChildren ? 'Hide child sitemaps' : `Show ${sitemap.children.length} child sitemap${sitemap.children.length === 1 ? '' : 's'}`}
            </button>
            {#if showChildren}
              <ul class="space-y-1">
                {#each sitemap.children as child, i (i)}
                  <li class="rounded-lg border border-white/40 bg-white/40 px-2 py-1 dark:border-white/10 dark:bg-white/5">
                    <a href={child.url} target="_blank" rel="noopener noreferrer" class="block break-all text-[11px] text-indigo-600 hover:underline dark:text-indigo-300">{child.url}</a>
                    <p class="text-[10px] text-slate-600 dark:text-slate-400">
                      {#if child.error}
                        <span class="text-rose-600 dark:text-rose-400">{child.error}</span>
                      {:else}
                        {child.isIndex ? 'nested index · ' : ''}{child.urlCount} URL{child.urlCount === 1 ? '' : 's'}
                      {/if}
                    </p>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      {:else}
        <p class="text-slate-700 dark:text-slate-300">
          Sitemap · {sitemap.urlCount} entr{sitemap.urlCount === 1 ? 'y' : 'ies'}
        </p>
        {#if sitemap.sample.length > 0}
          <div class="space-y-1">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sample (first 10)</p>
            <ul class="space-y-0.5">
              {#each sitemap.sample as s, i (i)}
                <li><a href={s} target="_blank" rel="noopener noreferrer" class="break-all text-indigo-600 hover:underline dark:text-indigo-300">{s}</a></li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}
      {#if sitemap.error}
        <p class="text-amber-600 dark:text-amber-400">{sitemap.error}</p>
      {/if}
    {:else}
      <p class="text-slate-500 dark:text-slate-400">{sitemap.error ?? 'No /sitemap.xml at this host.'}</p>
    {/if}
  </div>
</section>

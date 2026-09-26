<script lang="ts">
  import { safeHref } from '../../util/safe-href';
  import { tooltip } from '../../actions/tooltip';
  import { bandClasses } from '../../audit/band';
  import type { RobotsInfo } from '../../scrapers/SiteFiles';

  export let robots: RobotsInfo;

  let showRaw = false;
</script>

<section class="overflow-hidden rounded-2xl border border-white/40 bg-white/50 shadow-md shadow-indigo-500/5 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
  <header class="flex items-center justify-between border-b border-white/40 px-4 py-2 dark:border-white/10">
    <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-50">robots.txt</h4>
    {#if robots.present}
      <span class="rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider {bandClasses('good').chip}">Found</span>
    {:else}
      <span class="rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider {bandClasses('fail').chip}">Missing</span>
    {/if}
  </header>
  <div class="space-y-2 px-4 py-3 text-xs">
    {#if robots.present}
      <p class="text-slate-700 dark:text-slate-300">
        {robots.groups.length} user-agent group(s) · {robots.sitemaps.length} sitemap directive(s)
      </p>
      {#if robots.sitemaps.length > 0}
        <div class="space-y-1">
          <p class="text-[0.6875rem] font-semibold uppercase tracking-wider ms-muted">Sitemaps</p>
          <ul class="space-y-0.5">
            {#each robots.sitemaps as s, i (i)}
              <li>
                {#if safeHref(s)}
                  <a href={safeHref(s)} target="_blank" rel="noopener noreferrer" class="break-all text-indigo-600 hover:underline dark:text-indigo-300">{s}</a>
                {:else}
                  <span class="break-all ms-muted" use:tooltip={'Not an http(s) URL'}>{s}<span class="sr-only"> (not an http(s) URL)</span></span>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if robots.groups.length > 0}
        <div class="space-y-1">
          <p class="text-[0.6875rem] font-semibold uppercase tracking-wider ms-muted">User-agent groups</p>
          <ul class="space-y-1">
            {#each robots.groups.slice(0, 5) as g, i (i)}
              <li class="rounded-lg border border-white/40 bg-white/40 px-2 py-1 dark:border-white/10 dark:bg-white/5">
                <p class="font-medium text-slate-900 dark:text-slate-100">{g.userAgents.join(', ')}</p>
                <p class="text-[0.6875rem] ms-muted">disallow: {g.disallow.length} · allow: {g.allow.length}</p>
              </li>
            {/each}
            {#if robots.groups.length > 5}
              <li class="text-[0.6875rem] ms-muted">…{robots.groups.length - 5} more</li>
            {/if}
          </ul>
        </div>
      {/if}
      {#if robots.raw}
        <button type="button" on:click={() => (showRaw = !showRaw)} class="text-[0.6875rem] font-medium text-indigo-600 hover:underline dark:text-indigo-300">
          {showRaw ? 'Hide raw' : 'Show raw'}
        </button>
        {#if showRaw}
          <pre class="max-h-48 overflow-auto rounded-lg bg-slate-900/80 p-2 text-[0.6875rem] text-slate-100 dark:bg-slate-950/80">{robots.raw}</pre>
        {/if}
      {/if}
    {:else}
      <p class="ms-muted">{robots.error ?? 'No /robots.txt at this host.'}</p>
    {/if}
  </div>
</section>

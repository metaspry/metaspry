<script lang="ts">
  import type { LlmsInfo } from '../../scrapers/SiteFiles';

  export let llms: LlmsInfo;

  let showRaw = false;
</script>

<section class="overflow-hidden rounded-2xl border border-white/40 bg-white/50 shadow-md shadow-indigo-500/5 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
  <header class="flex items-center justify-between border-b border-white/40 px-4 py-2 dark:border-white/10">
    <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-50">llms.txt</h4>
    {#if llms.present}
      <span class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Found</span>
    {:else}
      <span class="rounded-full bg-slate-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-500/20 dark:text-slate-300">Not present</span>
    {/if}
  </header>
  <div class="space-y-2 px-4 py-3 text-xs">
    {#if llms.present}
      <p class="text-slate-700 dark:text-slate-300">{llms.sections.length} section(s)</p>
      <ul class="space-y-2">
        {#each llms.sections as section, i (i)}
          <li>
            <p class="font-medium text-slate-900 dark:text-slate-100">{section.heading}</p>
            {#if section.links.length > 0}
              <ul class="ml-3 mt-1 list-disc space-y-0.5 text-[11px] marker:text-slate-400">
                {#each section.links as link, j (j)}
                  <li><a href={link.url} target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline dark:text-indigo-300">{link.label}</a></li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
      {#if llms.raw}
        <button type="button" on:click={() => (showRaw = !showRaw)} class="text-[10px] font-medium text-indigo-600 hover:underline dark:text-indigo-300">
          {showRaw ? 'Hide raw' : 'Show raw'}
        </button>
        {#if showRaw}
          <pre class="max-h-48 overflow-auto rounded-lg bg-slate-900/80 p-2 text-[10px] text-slate-100 dark:bg-slate-950/80">{llms.raw}</pre>
        {/if}
      {/if}
    {:else}
      <p class="text-slate-500 dark:text-slate-400">
        {llms.error ?? 'No /llms.txt at this host.'} <a href="https://llmstxt.org" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline dark:text-indigo-300">What is llms.txt?</a>
      </p>
    {/if}
  </div>
</section>

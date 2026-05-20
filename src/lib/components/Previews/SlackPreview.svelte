<script lang="ts">
  export let title: string;
  export let description: string;
  export let image: string | null;
  export let host: string;
</script>

<section
  aria-label="Slack preview"
  class="overflow-hidden rounded-2xl border border-white/40 bg-white/60 shadow-md shadow-indigo-500/5 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
>
  <header class="border-b border-white/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
    Slack
  </header>
  <div class="flex gap-3 bg-white p-3 dark:bg-slate-900">
    <div class="w-1 flex-shrink-0 rounded bg-slate-300 dark:bg-slate-600" />
    <div class="min-w-0 flex-1 space-y-1">
      <p class="text-[11px] text-slate-500 dark:text-slate-400">{host}</p>
      <p class="line-clamp-1 text-sm font-semibold text-blue-600 dark:text-blue-300">{title}</p>
      <p class="line-clamp-3 text-xs text-slate-700 dark:text-slate-300">{description}</p>
      {#if image}
        <div class="mt-1 aspect-[2/1] w-full overflow-hidden rounded">
          <img src={image} alt="" class="h-full w-full object-cover" loading="lazy" />
        </div>
      {/if}
    </div>
  </div>
</section>

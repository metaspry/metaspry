<script lang="ts">
  export let title: string;
  export let description: string;
  export let host: string;
  export let canonical: string;
  export let icon: string | null;

  function trimUrl(u: string): string {
    try {
      const p = new URL(u);
      return `${p.hostname.replace(/^www\./, '')} › ${p.pathname.split('/').filter(Boolean).join(' › ')}`;
    } catch {
      return host;
    }
  }
</script>

<section
  aria-label="Google search preview"
  class="overflow-hidden rounded-2xl border border-white/40 bg-white/80 shadow-md shadow-indigo-500/5 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
>
  <header class="border-b border-white/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
    Google · Search
  </header>
  <div class="space-y-1 bg-white p-3 dark:bg-slate-900">
    <div class="flex items-center gap-2">
      {#if icon}
        <img src={icon} alt="" class="h-5 w-5 rounded-full object-cover" loading="lazy" />
      {:else}
        <div class="h-5 w-5 rounded-full bg-slate-300 dark:bg-slate-600" />
      {/if}
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs text-slate-700 dark:text-slate-300">{host}</p>
        <p class="truncate text-[10px] text-slate-500 dark:text-slate-400">{trimUrl(canonical)}</p>
      </div>
    </div>
    <p class="line-clamp-1 text-base font-medium leading-tight text-blue-700 dark:text-blue-300">{title}</p>
    <p class="line-clamp-2 text-xs text-slate-700 dark:text-slate-300">{description}</p>
  </div>
</section>

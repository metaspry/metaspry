<!-- Visible words while the page is read (item 7); the polite status region in Extension.svelte
     announces the same, so the shapes stay aria-hidden. -->
<p class="text-xs ms-muted" aria-hidden="true">Reading the page…</p>
<div class="flex flex-wrap gap-3" aria-hidden="true">
  {#each Array(6) as _, i (i)}
    <div
      class="min-w-[160px] flex-grow flex-shrink motion-safe:animate-pulse rounded-2xl border border-white/40 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5"
    >
      <div class="mb-3 h-2.5 w-16 rounded bg-slate-300/60 dark:bg-slate-600/40" />
      <div class="mb-1.5 h-3 w-3/4 rounded bg-slate-300/60 dark:bg-slate-600/40" />
      <div class="h-3 w-2/3 rounded bg-slate-300/60 dark:bg-slate-600/40" />
    </div>
  {/each}
</div>

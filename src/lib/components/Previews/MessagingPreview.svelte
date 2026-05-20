<script lang="ts">
  export let title: string;
  export let description: string;
  export let image: string | null;
  export let host: string;
</script>

<section
  aria-label="Messaging preview (iMessage / WhatsApp)"
  class="overflow-hidden rounded-2xl border border-white/40 bg-white/60 shadow-md shadow-indigo-500/5 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
>
  <header class="border-b border-white/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
    iMessage / WhatsApp
  </header>
  <div class="bg-emerald-50 p-3 dark:bg-emerald-950/30">
    <div class="ml-auto max-w-[85%] overflow-hidden rounded-2xl bg-emerald-500/90 text-white shadow">
      {#if image}
        <div class="aspect-[1.91/1] w-full">
          <img src={image} alt="" class="h-full w-full object-cover" loading="lazy" />
        </div>
      {/if}
      <div class="space-y-0.5 px-3 py-2">
        <p class="line-clamp-2 text-sm font-semibold">{title}</p>
        <p class="line-clamp-2 text-[11px] opacity-90">{description}</p>
        <p class="text-[10px] opacity-80">{host}</p>
      </div>
    </div>
  </div>
</section>

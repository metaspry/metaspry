<script lang="ts">
  export let length: number;
  export let min: number;
  export let max: number;

  $: pctRaw = max > 0 ? (length / max) * 100 : 0;
  $: pct = Math.min(100, Math.max(0, pctRaw));
  $: overflow = length > max;
  $: under = length < min;

  $: barClass = overflow
    ? 'bg-rose-500 dark:bg-rose-400'
    : under
      ? 'bg-amber-500 dark:bg-amber-400'
      : 'bg-emerald-500 dark:bg-emerald-400';
</script>

<div class="flex items-center gap-2">
  <div class="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-700/40">
    <div class="absolute inset-y-0 left-0 {barClass} transition-all" style="width: {pct}%" />
    {#if max > 0}
      <span class="pointer-events-none absolute inset-y-0" style="left: {Math.min(100, (min / max) * 100)}%; width: 1px; background: rgba(0,0,0,0.2);" />
    {/if}
  </div>
  <span class="tabular-nums text-[10px] text-slate-500 dark:text-slate-400">{length}/{max}</span>
</div>

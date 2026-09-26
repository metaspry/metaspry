<script lang="ts">
  import { bandClasses } from '../../audit/band';

  export let length: number;
  export let min: number;
  export let max: number;

  $: pctRaw = max > 0 ? (length / max) * 100 : 0;
  $: pct = Math.min(100, Math.max(0, pctRaw));
  $: overflow = length > max;
  $: under = length < min;

  // Band tokens (R2-29): over the max fails, under the min needs work.
  $: barClass = bandClasses(overflow ? 'fail' : under ? 'warn' : 'good').fill;
</script>

<div class="flex items-center gap-2">
  <div class="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-700/40">
    <div class="absolute inset-y-0 left-0 {barClass} motion-safe:transition-all" style="width: {pct}%" />
    {#if max > 0}
      <span class="pointer-events-none absolute inset-y-0" style="left: {Math.min(100, (min / max) * 100)}%; width: 1px; background: rgba(0,0,0,0.2);" />
    {/if}
  </div>
  <span class="tabular-nums text-[10px] ms-muted">{length}/{max}</span>
</div>

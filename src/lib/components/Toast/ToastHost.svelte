<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts, type ToastEntry } from './toast';
  import { dur } from '../../motion';

  // Success / error: dark text on a pale tint in light (8.57:1 / 7.97:1), the -300 hue on the popover
  // tint in dark (9.43:1 / 7.61:1). White on emerald-600 was 3.77:1. The toasts have no close control.
  function variantClass(v: ToastEntry['variant']): string {
    if (v === 'success')
      return 'border border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-300/30 dark:bg-popover dark:text-emerald-300';
    if (v === 'error') return 'border border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-300/30 dark:bg-popover dark:text-rose-300';
    return 'bg-slate-900 text-white dark:border dark:border-white/10 dark:bg-popover/90';
  }
</script>

<div class="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
  {#each $toasts as t (t.id)}
    <div
      in:fly={{ y: 16, duration: dur(180) }}
      out:fly={{ y: 8, duration: dur(140) }}
      class="pointer-events-auto rounded-full px-4 py-2 text-xs font-medium shadow-lg {variantClass(t.variant)}"
    >
      {t.message}
    </div>
  {/each}
</div>

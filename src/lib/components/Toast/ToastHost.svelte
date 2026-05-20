<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts, type ToastEntry } from './toast';

  function variantClass(v: ToastEntry['variant']): string {
    if (v === 'success') return 'bg-emerald-600 text-white';
    if (v === 'error') return 'bg-rose-600 text-white';
    return 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900';
  }
</script>

<div class="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
  {#each $toasts as t (t.id)}
    <div
      in:fly={{ y: 16, duration: 180 }}
      out:fly={{ y: 8, duration: 140 }}
      class="pointer-events-auto rounded-full px-4 py-2 text-xs font-medium shadow-lg {variantClass(t.variant)}"
    >
      {t.message}
    </div>
  {/each}
</div>

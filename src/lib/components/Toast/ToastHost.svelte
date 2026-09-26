<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts, dismissToast, type ToastEntry } from './toast';
  import { dur } from '../../motion';

  // Same fills as the web app's toasts (R2-27, V3-12): its Tailwind 4 emerald-700 / rose-700 are
  // #007a55 / #c70036 (white 5.3:1 / 5.9:1), so they are written as values here, where Tailwind 3's
  // steps are a shade off. slate-900 / slate-50 for a neutral note.
  function variantClass(v: ToastEntry['variant']): string {
    if (v === 'success') return 'bg-[#007a55] text-white';
    if (v === 'error') return 'bg-[#c70036] text-white';
    return 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900';
  }

  // The close control's hover: a white wash on the saturated and dark fills, a dark wash only on the
  // light dark-mode note (a dark wash on green or red was near invisible, V3-12).
  function closeHover(v: ToastEntry['variant']): string {
    return v === 'default' ? 'hover:bg-white/[.15] dark:hover:bg-slate-900/10' : 'hover:bg-white/[.15]';
  }

  // Two live regions that are always mounted (KB3-12), like the web app: a toast is text added to an
  // existing region, which screen readers announce reliably, not a freshly inserted `role="alert"`
  // node. Notes above, errors below, the app's order.
  $: errors = $toasts.filter((t) => t.variant === 'error');
  $: notes = $toasts.filter((t) => t.variant !== 'error');
  $: regions = [
    { list: notes, role: 'status', live: 'polite' as const },
    { list: errors, role: 'alert', live: 'assertive' as const },
  ];
</script>

<div class="pointer-events-none fixed bottom-4 left-4 right-4 z-50 flex flex-col items-end gap-2">
  {#each regions as region (region.role)}
    <div role={region.role} aria-live={region.live} class="flex flex-col items-end gap-2">
      {#each region.list as t (t.id)}
        <div
          in:fly={{ y: 16, duration: dur(180) }}
          out:fly={{ y: 8, duration: dur(140) }}
          class="pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl py-1.5 pl-4 pr-1.5 text-xs font-medium shadow-lg {variantClass(t.variant)}"
        >
          <span class="min-w-0 flex-1">{t.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            on:click={() => dismissToast(t.id)}
            class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm leading-none transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-current {closeHover(t.variant)}"
          >×</button>
        </div>
      {/each}
    </div>
  {/each}
</div>

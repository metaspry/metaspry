<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts, dismissToast, type ToastEntry } from './toast';
  import { dur } from '../../motion';

  // Same meaning as the web app's toasts (R2-27): a saturated fill that says what happened in both
  // themes - emerald-700 success, rose-700 error, white text (5.48:1 / 6.29:1) - and slate-900 /
  // slate-50 for a neutral note. The old dark toasts were all the popover tint (1.10:1 vs the page).
  function variantClass(v: ToastEntry['variant']): string {
    if (v === 'success') return 'bg-emerald-700 text-white';
    if (v === 'error') return 'bg-rose-700 text-white';
    return 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900';
  }

  // Errors are `role="alert"` (announced at once, even mid-sentence); the rest share one polite live
  // region that exists before any toast arrives, so screen readers pick up each new one.
  $: errors = $toasts.filter((t) => t.variant === 'error');
  $: notes = $toasts.filter((t) => t.variant !== 'error');
</script>

<div class="pointer-events-none fixed bottom-4 left-4 right-4 z-50 flex flex-col items-end gap-2">
  {#each errors as t (t.id)}
    <div
      role="alert"
      in:fly={{ y: 16, duration: dur(180) }}
      out:fly={{ y: 8, duration: dur(140) }}
      class="pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl py-1.5 pl-4 pr-1.5 text-xs font-medium shadow-lg {variantClass(t.variant)}"
    >
      <span class="min-w-0 flex-1">{t.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        on:click={() => dismissToast(t.id)}
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm leading-none transition hover:bg-white/20 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-current"
      >×</button>
    </div>
  {/each}
  <div class="flex flex-col items-end gap-2" aria-live="polite">
    {#each notes as t (t.id)}
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
          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm leading-none transition hover:bg-white/20 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-current dark:hover:bg-slate-900/10"
        >×</button>
      </div>
    {/each}
  </div>
</div>

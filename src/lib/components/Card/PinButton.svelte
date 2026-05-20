<script lang="ts">
  import { pinned, togglePinned, isPinned } from '../../storage/pinned';
  import { toast } from '../Toast/toast';

  export let tagKey: string;

  $: active = isPinned($pinned, tagKey);

  let shownExplainer = false;

  function onClick() {
    const wasActive = active;
    togglePinned(tagKey);
    if (!wasActive && !shownExplainer) {
      shownExplainer = true;
      toast('Pinned to top. Pinned tags stay at the top across pages.', 'success');
    }
  }
</script>

<button
  type="button"
  aria-label={active ? `Unpin ${tagKey}` : `Pin ${tagKey}`}
  aria-pressed={active}
  title={active ? 'Unpin from top' : 'Pin to top of list'}
  on:click={onClick}
  class="flex h-7 w-7 items-center justify-center rounded-lg transition {active
    ? 'text-amber-500 hover:bg-amber-100/60 dark:text-amber-300 dark:hover:bg-amber-500/10'
    : 'text-slate-400 hover:bg-white/60 hover:text-amber-500 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-amber-300'}"
>
  {#if active}
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
      <path d="m12 2 2.7 6.2 6.8.6-5.2 4.5 1.6 6.7L12 16.7 6.1 20l1.6-6.7L2.5 8.8l6.8-.6z" />
    </svg>
  {:else}
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
      <path d="m12 2 2.7 6.2 6.8.6-5.2 4.5 1.6 6.7L12 16.7 6.1 20l1.6-6.7L2.5 8.8l6.8-.6z" />
    </svg>
  {/if}
</button>

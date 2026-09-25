<script lang="ts">
  import type { GridProps } from "./Grid.ts";
  import { FOCUS_RING } from "../toolbar";

  export let items: GridProps[] = [];
</script>

<div class="flex flex-row flex-wrap gap-3">
  {#each items as item}
    <!-- A real button: in the tab order, Enter and Space start the scan (the old div was not). -->
    <button
      type="button"
      on:click={item.onClick}
      class="{item.cssClass ?? ''} {FOCUS_RING} group relative flex w-full min-w-[160px] flex-grow flex-shrink cursor-pointer flex-col gap-1 overflow-hidden rounded-2xl border border-white/40 bg-white/50 p-5 text-left shadow-md shadow-indigo-500/5 backdrop-blur-md transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-lg active:scale-[0.98] active:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:active:bg-white/[0.07]"
    >
      <span aria-hidden="true" class="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-300/30 blur-2xl transition group-hover:bg-indigo-300/50 dark:bg-indigo-400/20" />
      <span class="relative z-10 flex flex-1 flex-col">
        {#if item.number}
          <span class="text-2xl font-semibold text-slate-900 dark:text-slate-50">{item.number}</span>
        {/if}
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{item.text}</span>
      </span>
    </button>
  {/each}
</div>

<script lang="ts">
  import type { GridProps } from "./Grid.ts";
  import { FOCUS_RING } from "../toolbar";

  export let items: GridProps[] = [];
</script>

<div class="flex flex-row flex-wrap gap-3">
  {#each items as item}
    <!-- A real button: in the tab order, Enter and Space start the scan (the old div was not).
         The brand fill: scanning is the extension's job, so this is the view's one primary action
         (T-07 / V2-10); the header "Sign in" is secondary. White on indigo-600 6.3:1, hover darker. -->
    <button
      type="button"
      on:click={item.onClick}
      class="{item.cssClass ?? ''} {FOCUS_RING} group relative flex w-full min-w-[160px] flex-grow flex-shrink cursor-pointer flex-col gap-1 overflow-hidden rounded-2xl border border-indigo-700/40 bg-indigo-600 p-5 text-left shadow-md shadow-indigo-500/30 transition duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-lg motion-safe:active:scale-[0.98] dark:border-indigo-300/30"
    >
      <span aria-hidden="true" class="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-violet-400/40 blur-2xl transition group-hover:bg-violet-400/60" />
      <span class="relative z-10 flex flex-1 flex-col">
        {#if item.number}
          <span class="text-2xl font-semibold text-white">{item.number}</span>
        {/if}
        <span class="text-sm font-semibold text-white">{item.text}</span>
      </span>
    </button>
  {/each}
</div>

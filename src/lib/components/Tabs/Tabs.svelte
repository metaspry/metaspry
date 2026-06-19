<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';

  export interface TabDef {
    id: string;
    label: string;
    icon?: string;
  }

  export let tabs: TabDef[] = [];
  export let active: string;

  const dispatch = createEventDispatcher<{ change: string }>();
  const refs: Record<string, HTMLButtonElement | null> = {};

  function select(id: string) {
    if (id !== active) dispatch('change', id);
  }

  async function selectAndFocus(id: string) {
    select(id);
    await tick();
    refs[id]?.focus();
  }

  function onKey(event: KeyboardEvent) {
    const idx = tabs.findIndex((t) => t.id === active);
    if (idx < 0) return;
    if (event.key === 'ArrowRight') {
      const next = tabs[(idx + 1) % tabs.length];
      if (next) void selectAndFocus(next.id);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
      if (prev) void selectAndFocus(prev.id);
      event.preventDefault();
    } else if (event.key === 'Home') {
      const first = tabs[0];
      if (first) void selectAndFocus(first.id);
      event.preventDefault();
    } else if (event.key === 'End') {
      const last = tabs[tabs.length - 1];
      if (last) void selectAndFocus(last.id);
      event.preventDefault();
    }
  }
</script>

<div
  role="tablist"
  aria-label="Analysis views"
  on:keydown={onKey}
  class="flex w-full flex-wrap items-center gap-1 rounded-2xl border border-white/40 bg-white/40 p-1 text-xs font-medium backdrop-blur-md dark:border-white/10 dark:bg-white/5"
>
  {#each tabs as tab}
    <button
      type="button"
      role="tab"
      aria-selected={tab.id === active}
      tabindex={tab.id === active ? 0 : -1}
      bind:this={refs[tab.id]}
      on:click={() => select(tab.id)}
      class="flex h-10 flex-1 basis-16 items-center justify-center gap-1.5 rounded-xl px-2 transition {tab.id === active
        ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
    >
      {#if tab.icon}
        {@html tab.icon}
      {/if}
      <span>{tab.label}</span>
    </button>
  {/each}
</div>

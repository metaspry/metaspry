<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { settings, updateSettings, resetSettings, DEFAULT_SETTINGS } from '../../storage/settings';
  import { createEventDispatcher } from 'svelte';

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  function close() {
    dispatch('close');
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
  }

  function setNum(field: keyof typeof DEFAULT_SETTINGS, value: number) {
    if (Number.isFinite(value) && value >= 0) {
      updateSettings({ [field]: value } as Partial<typeof DEFAULT_SETTINGS>);
    }
  }

  function setWeight(severity: keyof typeof DEFAULT_SETTINGS.weights, value: number) {
    if (Number.isFinite(value) && value >= 0) {
      updateSettings({ weights: { ...$settings.weights, [severity]: value } });
    }
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <div transition:fade={{ duration: 120 }} class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" on:click={close} role="presentation" />
  <aside
    transition:fly={{ x: 320, duration: 220 }}
    class="fixed inset-y-0 right-0 z-50 flex w-full max-w-[320px] flex-col gap-4 overflow-y-auto border-l border-white/40 bg-white/90 p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90"
    role="dialog"
    aria-label="Settings"
  >
    <header class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-slate-900 dark:text-slate-50">Settings</h3>
      <button type="button" aria-label="Close settings" on:click={close} class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-50">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </header>

    <section class="flex flex-col gap-2">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Length thresholds</h4>
      <div class="grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Title min
          <input type="number" min="0" value={$settings.titleMin} on:input={(e) => setNum('titleMin', Number(e.currentTarget.value))} class="rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Title max
          <input type="number" min="0" value={$settings.titleMax} on:input={(e) => setNum('titleMax', Number(e.currentTarget.value))} class="rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Desc min
          <input type="number" min="0" value={$settings.descMin} on:input={(e) => setNum('descMin', Number(e.currentTarget.value))} class="rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Desc max
          <input type="number" min="0" value={$settings.descMax} on:input={(e) => setNum('descMax', Number(e.currentTarget.value))} class="rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          og:desc min
          <input type="number" min="0" value={$settings.ogDescMin} on:input={(e) => setNum('ogDescMin', Number(e.currentTarget.value))} class="rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          og:desc max
          <input type="number" min="0" value={$settings.ogDescMax} on:input={(e) => setNum('ogDescMax', Number(e.currentTarget.value))} class="rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </label>
      </div>
    </section>

    <section class="flex flex-col gap-2">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rule weights</h4>
      <div class="grid grid-cols-3 gap-2">
        <label class="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Required
          <input type="number" min="0" value={$settings.weights.required} on:input={(e) => setWeight('required', Number(e.currentTarget.value))} class="rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Recommended
          <input type="number" min="0" value={$settings.weights.recommended} on:input={(e) => setWeight('recommended', Number(e.currentTarget.value))} class="rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Best-pr.
          <input type="number" min="0" value={$settings.weights['best-practice']} on:input={(e) => setWeight('best-practice', Number(e.currentTarget.value))} class="rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
        </label>
      </div>
    </section>

    <button
      type="button"
      on:click={resetSettings}
      class="self-start rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
    >Restore defaults</button>
  </aside>
{/if}

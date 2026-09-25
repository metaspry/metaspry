<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import {
    settings,
    updateSettings,
    resetSettings,
    DEFAULT_SETTINGS,
    type Settings,
    type RuleWeights,
  } from '../../storage/settings';
  import { validateSettings, type SettingsField } from '../../storage/validate-settings';
  import { cloudIsPro, APP_URL } from '../../cloud/plan';
  import { mode, switchMode, type Mode } from '../../mode';
  import { shortcutsEnabled, setShortcutsEnabled } from '../../storage/shortcuts';
  import { toast } from '../Toast/toast';
  import { tooltip } from '../../actions/tooltip';
  import { cycleTab, focusables } from '../../actions/popover';
  import { FOCUS_RING } from '../toolbar';
  import { dur } from '../../motion';

  const SURFACES: { value: Mode; label: string; hint: string }[] = [
    { value: 'sidepanel', label: 'Side panel', hint: 'Stays open beside the page while you browse.' },
    { value: 'popup', label: 'Popup', hint: 'Opens from the toolbar icon; closes when you click away.' },
  ];

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  const TITLE_ID = 'settings-drawer-title';
  const RESET_ARM_MS = 5000;

  const LENGTH_ROWS: { label: string; min: SettingsField; max: SettingsField }[] = [
    { label: 'Title', min: 'titleMin', max: 'titleMax' },
    { label: 'Description', min: 'descMin', max: 'descMax' },
    { label: 'og:description', min: 'ogDescMin', max: 'ogDescMax' },
  ];
  const WEIGHT_FIELDS: { key: keyof RuleWeights; label: string }[] = [
    { key: 'required', label: 'Required' },
    { key: 'recommended', label: 'Recommended' },
    { key: 'best-practice', label: 'Best practice' },
  ];

  const ABOUT_LINKS = [
    { label: 'metaspry.com', href: 'https://metaspry.com' },
    { label: 'Docs', href: 'https://metaspry.com/docs/' },
    { label: 'Roadmap', href: 'https://metaspry.com/roadmap/' },
    { label: 'Blog', href: 'https://metaspry.com/blog/' },
    { label: 'Report a bug', href: 'https://github.com/metaspry/metaspry/issues/new/choose' },
  ];

  const version =
    typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : 'dev';

  // The form edits a draft. Nothing persists until Save: the old drawer wrote chrome.storage AND a
  // Firestore document on every keystroke. `baseline` is the stored value the draft was copied
  // from, so a cloud pull or the other surface can refresh an untouched form without clobbering
  // one being typed in.
  let draft: Settings = clone(DEFAULT_SETTINGS);
  let baseline: Settings = clone(DEFAULT_SETTINGS);
  let drawerEl: HTMLElement | null = null;
  let resetBtn: HTMLButtonElement | null = null;
  let confirmBtn: HTMLButtonElement | null = null;
  let confirmGroup: HTMLElement | null = null;
  let opener: Element | null = null;
  let wasOpen = false;
  let resetArmed = false;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  function clone(s: Settings): Settings {
    return { ...s, weights: { ...s.weights } };
  }
  function same(a: Settings, b: Settings): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  $: dirty = !same(draft, baseline);
  $: problems = validateSettings(draft);
  $: canSave = dirty && problems.length === 0;
  $: isDefault = same($settings, DEFAULT_SETTINGS);
  $: problemFor = (field: SettingsField | 'weights'): string | undefined =>
    problems.find((p) => p.field === field)?.message;
  $: weightProblem = problemFor('weights');

  // Follow the store only while the form is untouched (compared inline: reading `dirty` here
  // would make dirty -> draft -> dirty a cycle for the compiler).
  $: if (!same(baseline, $settings) && same(draft, baseline)) {
    baseline = clone($settings);
    draft = clone($settings);
  }

  // The reset on open happens HERE, inside the reactive statement, so the compiler orders it
  // before `dirty` and `problems`. Done inside a helper function those assignments were invisible
  // to it: a reopen after a dirty close showed a stale "Unsaved changes" chip, an enabled Save on
  // an unchanged form, and old validation errors on fields that were now valid.
  $: if (open !== wasOpen) {
    wasOpen = open;
    if (open) {
      opener = document.activeElement;
      baseline = clone($settings);
      draft = clone($settings);
      disarmReset();
      void focusIn();
    } else {
      onClose();
    }
  }

  // The first threshold input (Pro) or, when there is none, the first control (the close
  // button). Never the Surface radio: in popup mode one Space or arrow key on it switches surface
  // and closes the window.
  async function focusIn() {
    await tick();
    if (!drawerEl) return;
    (drawerEl.querySelector<HTMLElement>('input[type="number"]') ?? focusables(drawerEl)[0])?.focus();
  }

  function onClose() {
    disarmReset();
    if (opener instanceof HTMLElement) opener.focus();
    opener = null;
  }

  onDestroy(() => disarmReset());

  function close() {
    dispatch('close');
  }

  // Esc closes; Tab and Shift+Tab stay inside the dialog (it is modal, but the popup has no inert
  // support to lean on). `cycleTab` is shared with the shortcuts help (actions/popover.ts).
  function onKey(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (drawerEl) cycleTab(event, drawerEl);
  }

  // A cleared box is NaN, which the validator reports; the old `setNum` ignored it and kept
  // scoring with the previous value behind an empty field.
  function readNumber(event: Event): number {
    const raw = (event.currentTarget as HTMLInputElement).value.trim();
    return raw === '' ? Number.NaN : Number(raw);
  }
  function setLength(field: SettingsField, event: Event) {
    draft = { ...draft, [field]: readNumber(event) };
  }
  function setWeight(key: keyof RuleWeights, event: Event) {
    draft = { ...draft, weights: { ...draft.weights, [key]: readNumber(event) } };
  }

  function save() {
    if (!canSave) return;
    try {
      const next = clone(draft);
      updateSettings(next);
      // Only after the write: a throw must leave the form dirty, not "saved".
      baseline = next;
      toast('Scoring rules saved', 'success');
    } catch {
      toast('Could not save', 'error');
    }
  }

  // Arming swaps the Reset button for "Reset? Yes, reset / Cancel", so focus follows the swap
  // instead of falling to <body> (a keyboard or screen-reader user would otherwise lose their
  // place, and "Reset?" would never be announced).
  async function armReset() {
    resetArmed = true;
    resetTimer = setTimeout(() => disarmReset(true), RESET_ARM_MS);
    await tick();
    confirmBtn?.focus();
  }
  function disarmReset(refocus = false) {
    const hadFocus = !!confirmGroup?.contains(document.activeElement);
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;
    resetArmed = false;
    // Only take focus back when it was on the confirm controls; the timeout must not steal it from
    // an input the user moved on to.
    if (refocus && hadFocus) void tick().then(() => resetBtn?.focus());
  }
  function confirmReset() {
    disarmReset();
    baseline = clone(DEFAULT_SETTINGS);
    draft = clone(DEFAULT_SETTINGS);
    resetSettings();
    toast('Scoring rules reset to defaults', 'success');
    // Reset is now disabled (defaults, untouched), so focus goes to the first input instead.
    void focusIn();
  }

  const inputClass =
    'w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm tabular-nums text-slate-900 shadow-sm outline-none transition focus:ring-2 dark:bg-slate-800 dark:text-slate-100';
  // R-30: slate-500 edge 4.76:1 on white, slate-400 5.71:1 on slate-800 (slate-300 was 1.48:1).
  const inputOk = 'border-slate-500 focus:border-indigo-600 focus:ring-indigo-500/30 dark:border-slate-400';
  const inputBad = 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30';
  // >= 24 px tall with 8 px between targets (WCAG 2.5.8, R-48); they were 16.5 px, 13-15 px apart.
  const linkClass = `inline-flex h-6 items-center rounded px-1 hover:text-indigo-600 hover:underline dark:hover:text-indigo-300 ${FOCUS_RING}`;
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <div transition:fade={{ duration: dur(120) }} class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" on:click={close} role="presentation" />
  <aside
    bind:this={drawerEl}
    transition:fly={{ x: 360, duration: dur(220) }}
    class="fixed inset-y-0 right-0 z-50 flex w-full max-w-[360px] flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-popover dark:text-slate-100"
    role="dialog"
    aria-modal="true"
    aria-labelledby={TITLE_ID}
  >
    <header class="flex items-center justify-between">
      <div class="flex flex-col">
        <h3 id={TITLE_ID} class="text-base font-semibold text-slate-900 dark:text-slate-50">Settings</h3>
 <p class="text-xs ms-muted">Preferences and scoring rules</p>
      </div>
      <button
        type="button"
        aria-label="Close settings"
        use:tooltip={'Close settings (Esc)'}
        on:click={close}
 class="flex h-8 w-8 items-center justify-center rounded-lg ms-muted transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50 {FOCUS_RING}"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </header>

    <fieldset class="flex flex-col gap-2">
 <legend class="mb-2 text-xs font-semibold uppercase tracking-wider ms-muted">Preferences</legend>
      <div role="radiogroup" aria-label="Surface" class="grid grid-cols-2 gap-2">
        {#each SURFACES as s (s.value)}
          <label
            class="flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2 transition focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 focus-within:ring-offset-transparent dark:focus-within:ring-indigo-300 {$mode === s.value
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'}"
          >
            <input
              type="radio"
              name="surface"
              value={s.value}
              checked={$mode === s.value}
              on:change={() => switchMode(s.value)}
              class="sr-only"
            />
            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100">{s.label}</span>
 <span class="text-[11px] leading-snug ms-muted">{s.hint}</span>
          </label>
        {/each}
      </div>
      <!-- WCAG 2.1.4: single-character shortcuts can be turned off. Off leaves ? and Esc. -->
      <label class="mt-1 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-300 px-3 py-2 transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
        <input
          type="checkbox"
          role="switch"
          checked={$shortcutsEnabled}
          on:change={(e) => setShortcutsEnabled(e.currentTarget.checked)}
          aria-describedby="shortcuts-pref-hint"
          class="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600 {FOCUS_RING}"
        />
        <span class="flex flex-col gap-0.5">
          <span class="text-xs font-semibold text-slate-800 dark:text-slate-100">Single-key shortcuts</span>
          <span id="shortcuts-pref-hint" class="ms-muted text-[11px] leading-snug">/ search, r rescan, 1-6 tabs. Off: only ? and Esc work.</span>
        </span>
      </label>
    </fieldset>

    {#if $cloudIsPro}
      <p class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-indigo-500/10 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
        <span class="inline-flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Synced with your account
        </span>
        <a
          href={`${APP_URL}/settings`}
          target="_blank"
          rel="noopener noreferrer"
          use:tooltip={'Edit these settings in the Metaspry web app (opens a new tab)'}
          class="inline-flex items-center gap-1 rounded font-medium text-indigo-600 hover:underline dark:text-indigo-300 {FOCUS_RING}"
        >
          Open in web app
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
        </a>
      </p>

      <fieldset class="flex flex-col gap-3">
 <legend class="mb-2 text-xs font-semibold uppercase tracking-wider ms-muted">Length thresholds (characters)</legend>
        {#each LENGTH_ROWS as row (row.min)}
          {@const minProblem = problemFor(row.min)}
          {@const maxProblem = problemFor(row.max)}
          <div class="flex flex-col gap-1">
            <span class="text-xs font-medium text-slate-700 dark:text-slate-200">{row.label}</span>
            <div class="flex items-center gap-2">
 <label class="flex flex-1 items-center gap-1.5 text-[10px] uppercase tracking-wide ms-muted">
                min
                <input
                  type="number"
                  inputmode="numeric"
                  min="0"
                  step="1"
                  aria-label="{row.label} min"
                  aria-invalid={minProblem ? 'true' : undefined}
                  aria-describedby={minProblem ? `settings-problem-${row.min}` : undefined}
                  value={Number.isNaN(draft[row.min]) ? '' : draft[row.min]}
                  on:input={(e) => setLength(row.min, e)}
                  class="{inputClass} {minProblem ? inputBad : inputOk}"
                />
              </label>
 <span class="ms-muted" aria-hidden="true">–</span>
 <label class="flex flex-1 items-center gap-1.5 text-[10px] uppercase tracking-wide ms-muted">
                max
                <input
                  type="number"
                  inputmode="numeric"
                  min="0"
                  step="1"
                  aria-label="{row.label} max"
                  aria-invalid={maxProblem ? 'true' : undefined}
                  aria-describedby={maxProblem ? `settings-problem-${row.max}` : undefined}
                  value={Number.isNaN(draft[row.max]) ? '' : draft[row.max]}
                  on:input={(e) => setLength(row.max, e)}
                  class="{inputClass} {maxProblem ? inputBad : inputOk}"
                />
              </label>
            </div>
            {#if minProblem}
              <p id="settings-problem-{row.min}" class="text-xs text-rose-600 dark:text-rose-300" role="alert">{minProblem}</p>
            {/if}
            {#if maxProblem}
              <p id="settings-problem-{row.max}" class="text-xs text-rose-600 dark:text-rose-300" role="alert">{maxProblem}</p>
            {/if}
          </div>
        {/each}
      </fieldset>

      <fieldset class="flex flex-col gap-2">
 <legend class="mb-2 text-xs font-semibold uppercase tracking-wider ms-muted">Severity weights</legend>
        <p class="text-xs text-slate-600 dark:text-slate-300">
          Each rule earns its weight on pass, half on warn, zero on fail. Score = earned / total × 100.
        </p>
        <div class="grid grid-cols-3 gap-2">
          {#each WEIGHT_FIELDS as w (w.key)}
            <label class="flex flex-col gap-1 text-xs text-slate-700 dark:text-slate-200">
              {w.label}
              <input
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                aria-invalid={weightProblem ? 'true' : undefined}
                aria-describedby={weightProblem ? 'settings-problem-weights' : undefined}
                value={Number.isNaN(draft.weights[w.key]) ? '' : draft.weights[w.key]}
                on:input={(e) => setWeight(w.key, e)}
                class="{inputClass} {weightProblem ? inputBad : inputOk}"
              />
            </label>
          {/each}
        </div>
        {#if weightProblem}
          <p id="settings-problem-weights" class="text-xs text-rose-600 dark:text-rose-300" role="alert">{weightProblem}</p>
        {/if}
      </fieldset>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          on:click={save}
          use:tooltip={'Save scoring rules'}
          disabled={!canSave}
          class="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 {FOCUS_RING}"
        >Save</button>
        {#if resetArmed}
          <span bind:this={confirmGroup} class="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200" role="group" aria-label="Confirm reset">
            Reset?
            <button
              bind:this={confirmBtn}
              type="button"
              on:click={confirmReset}
              class="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 {FOCUS_RING}"
            >Yes, reset</button>
            <button
              type="button"
              on:click={() => disarmReset(true)}
              class="rounded-full px-2 py-1.5 text-xs font-medium text-slate-600 hover:underline dark:text-slate-300 {FOCUS_RING}"
            >Cancel</button>
          </span>
        {:else}
          <button
            bind:this={resetBtn}
            type="button"
            on:click={armReset}
            use:tooltip={'Restore the default thresholds and weights'}
            disabled={isDefault && !dirty}
            class="rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 {FOCUS_RING}"
          >Reset to defaults</button>
        {/if}
        {#if dirty}
          <span class="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Unsaved changes</span>
        {/if}
      </div>
    {:else}
      <section class="flex flex-col items-start gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/5 p-3">
        <span class="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Pro</span>
        <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-50">Custom scoring is a Pro feature</h4>
        <p class="text-xs text-slate-600 dark:text-slate-300">
          Free scans use Metaspry's default thresholds and rule weights. Upgrade to tune how the SEO/meta
          score is calculated — and keep it in sync with the web app.
        </p>
        <a
          href={`${APP_URL}/upgrade`}
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 {FOCUS_RING}"
        >Go Pro</a>
      </section>
    {/if}

 <footer class="mt-auto flex flex-col gap-1.5 border-t border-slate-200 pt-3 text-[11px] ms-muted dark:border-slate-800">
      <span>Metaspry v{version}</span>
      <nav aria-label="About Metaspry" class="flex flex-wrap items-center gap-x-2 gap-y-2">
        {#each ABOUT_LINKS as link, i (link.href)}
          {#if i > 0}<span aria-hidden="true">·</span>{/if}
          <a href={link.href} target="_blank" rel="noopener noreferrer" class={linkClass}>{link.label}</a>
        {/each}
      </nav>
    </footer>
  </aside>
{/if}

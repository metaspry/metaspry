<script lang="ts">
  import { onMount } from "svelte";
  import {
    cloudUser,
    initCloudAuth,
    cloudSignIn,
    cloudSignInWithGoogle,
    cloudSignOut,
  } from "../../cloud/auth";
  import { initCloudSettingsSync } from "../../cloud/settings";
  import { initCloudPlan, APP_URL } from "../../cloud/plan";
  import { initialsFor } from "../../cloud/initials";
  import { signInErrorMessage, googleSignInErrorMessage } from "../../cloud/auth-errors";
  import { tooltip } from "../../actions/tooltip";
  import { popover } from "../../actions/popover";
  import { FOCUS_RING } from "../toolbar";
  import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "../button";
  import {
    initCloudWorkspaces,
    workspaces,
    syncScope,
    setSyncScope,
    type CloudWorkspace,
  } from "../../cloud/workspaces";
  import { initWorkspaceScoring } from "../../cloud/workspace-scoring";

  let open = false;
  let trigger: HTMLButtonElement | null = null;
  let email = "";
  let password = "";
  let busy = false;
  let error = "";

  onMount(() => {
    initCloudAuth();
    initCloudSettingsSync();
    initCloudPlan();
    initCloudWorkspaces();
    initWorkspaceScoring();
  });

  async function submit() {
    if (busy || !email.trim() || !password) return;
    busy = true;
    error = "";
    try {
      await cloudSignIn(email.trim(), password);
      password = "";
    } catch (e) {
      // Mapped to a plain sentence: never the raw Firebase code (AGENTS 3.13).
      error = signInErrorMessage(e);
    } finally {
      busy = false;
    }
  }

  async function google() {
    if (busy) return;
    busy = true;
    error = "";
    try {
      await cloudSignInWithGoogle();
    } catch (e) {
      error = googleSignInErrorMessage(e);
      if (import.meta.env.DEV) console.error("[metaspry] google sign-in", e);
    } finally {
      busy = false;
    }
  }

  async function out() {
    await cloudSignOut();
    open = false;
  }

  function close() {
    open = false;
  }

  function pickPersonal() {
    setSyncScope({ kind: "personal" });
    open = false;
  }
  function pickWorkspace(w: CloudWorkspace) {
    setSyncScope({ kind: "workspace", wsId: w.id, name: w.name });
    open = false;
  }

  function openApp() {
    // Guarded like every other chrome.* entry point: `npm run dev` renders this component in a
    // plain browser, where `chrome` is undefined and the click would throw.
    if (typeof chrome === "undefined" || !chrome.tabs) return;
    // `active: true` on purpose, unlike History's background tab: the user is deliberately leaving
    // for the web app, so letting the popup close is the wanted behaviour.
    chrome.tabs.create({ url: `${APP_URL}/dashboard`, active: true });
  }

  // The sync-target list is a `role="menu"` of `menuitemradio`s: arrow keys, Home and End move
  // between them, and only the checked one sits in the Tab order (roving tabindex).
  function onTargetKey(event: KeyboardEvent) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const items = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    const last = items.length - 1;
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowDown" ? (index >= last ? 0 : index + 1) : index <= 0 ? last : index - 1;
    items[next]?.focus();
  }

  // The shared field (`.ms-input`, app.css, R3-24); `font-normal` undoes the label's medium weight.
  const FIELD_CLASS = "ms-input font-normal";
  // >= 24 px tall (WCAG 2.5.8), like the Settings footer links.
  const LINK_CLASS = `inline-flex h-6 items-center rounded px-1 font-medium text-indigo-600 hover:underline dark:text-indigo-300 ${FOCUS_RING}`;

  $: isPersonal = $syncScope.kind === "personal";
  // Roving tabindex needs one item at 0: a stored workspace missing from the list (fetch failed,
  // not loaded yet) checks nothing, so Personal takes the Tab stop instead.
  $: noneChecked = !isPersonal && !$workspaces.some((w) => $syncScope.kind === "workspace" && $syncScope.wsId === w.id);
  $: targetLabel = $syncScope.kind === "workspace" ? $syncScope.name : "Personal";
  $: initials = initialsFor($cloudUser?.email);
</script>

<!-- Not `relative`: the dropdown anchors to the header's right-hand block (Extension.svelte). -->
<div>
  <!-- Account control. Signed out it is the one "Sign in" call to action in the header; signed in
       it shows who and where scans go, and opens the account dropdown. -->
  {#if $cloudUser}
    <button
      bind:this={trigger}
      type="button"
      on:click={() => (open = !open)}
      aria-label="Account and sync target"
      aria-expanded={open}
      use:tooltip={`Signed in as ${$cloudUser.email} - saving scans to ${targetLabel}`}
      class="flex h-9 max-w-[170px] items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/70 py-0.5 pl-0.5 pr-2 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 {FOCUS_RING}"
    >
      <span class="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-[0.6875rem] font-bold text-white" aria-hidden="true">
        {initials}
        <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-600 dark:border-slate-900 dark:bg-emerald-400"></span>
      </span>
      <span class="hidden min-w-0 truncate min-[460px]:inline">{targetLabel}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ms-muted h-3 w-3 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
  {:else}
    <button
      bind:this={trigger}
      type="button"
      on:click={() => (open = !open)}
      aria-expanded={open}
      use:tooltip={"Sign in to sync scans to your account"}
      class="{BUTTON_SECONDARY} shrink-0 whitespace-nowrap"
    >Sign in</button>
  {/if}

  {#if open}
    <!-- `use:popover`: focus lands on the email field (signed out) or the first item (signed in),
         Escape or a press outside closes, focus returns to the account control. -->
    <div
      use:popover={{ trigger, onClose: close, initialFocus: 'input[type="email"]' }}
      role="dialog"
      aria-label={$cloudUser ? "Account and sync target" : "Sign in"}
      class="ms-popover absolute right-0 top-full z-50 mt-2 flex w-64 max-w-[calc(100vw-2.5rem)] flex-col gap-2 p-3"
    >
      {#if $cloudUser}
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true"></span>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-800 dark:text-slate-100">Synced</p>
            <p class="ms-muted truncate text-xs">{$cloudUser.email}</p>
          </div>
        </div>

        <button
          type="button"
          on:click={openApp}
          class="ms-menu-item {FOCUS_RING}"
        >
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>
          </span>
          <span class="min-w-0 flex-1 truncate">Open Metaspry web app</span>
        </button>

        <!-- The menu carries its own sentence-case name (KB3-13): named by this CSS-uppercased line,
             screen readers announced "SAVE NEW SCANS TO". The visible line is hidden from them. -->
        <p class="ms-muted mt-1 px-0.5 text-[0.6875rem] font-semibold tracking-wider uppercase" aria-hidden="true">
          Save new scans to
        </p>
        <!-- Scrolls past ~6 workspaces instead of pushing Sign out below the fold. -->
        <div role="menu" aria-label="Save new scans to" tabindex="-1" on:keydown={onTargetKey} class="flex max-h-56 flex-col gap-0.5 overflow-y-auto focus:outline-none">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={isPersonal}
            tabindex={isPersonal || noneChecked ? 0 : -1}
            on:click={pickPersonal}
            class="ms-menu-item {FOCUS_RING}"
          >
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </span>
            <span class="min-w-0 flex-1 truncate">Personal</span>
            {#if isPersonal}<span class="text-indigo-600 dark:text-indigo-300" aria-hidden="true">✓</span>{/if}
          </button>

          {#each $workspaces as w (w.id)}
            {@const checked = $syncScope.kind === "workspace" && $syncScope.wsId === w.id}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              tabindex={checked ? 0 : -1}
              on:click={() => pickWorkspace(w)}
              class="ms-menu-item {FOCUS_RING}"
            >
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[0.6875rem] font-bold text-white" style="background: linear-gradient(135deg,#6a55e0,#9b8bff)">{(w.name[0] ?? "W").toUpperCase()}</span>
              <span class="min-w-0 flex-1 truncate">{w.name}</span>
              {#if checked}<span class="text-indigo-600 dark:text-indigo-300" aria-hidden="true">✓</span>{/if}
            </button>
          {/each}
        </div>

        <div class="mt-0.5 border-t border-slate-200 pt-2 dark:border-white/[.15]">
          <button
            type="button"
            on:click={out}
            class="{BUTTON_SECONDARY} w-full"
            >Sign out</button
          >
        </div>
      {:else}
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-slate-800 dark:text-slate-100">Sync scans to the cloud</p>
          <button
            type="button"
            aria-label="Close"
            use:tooltip={"Close (Esc)"}
            on:click={close}
            class="-mr-1.5 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ms-muted transition hover:bg-indigo-500/25 hover:text-slate-900 dark:hover:bg-white/[.15] dark:hover:text-slate-50 {FOCUS_RING}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <p class="ms-muted text-xs">
          Sign in to sync your scans to the Metaspry web app (free account: your 10 most recent).
        </p>
        <!-- A real form: labels, names and autocomplete let password managers fill it, and Enter in
             either field submits. -->
        <form class="flex flex-col gap-2" on:submit|preventDefault={submit}>
          <label class="flex flex-col gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
            Email
            <input
              type="email"
              name="email"
              autocomplete="email"
              required
              bind:value={email}
              placeholder="you@company.com"
              class={FIELD_CLASS}
            />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
            Password
            <input
              type="password"
              name="password"
              autocomplete="current-password"
              required
              bind:value={password}
              class={FIELD_CLASS}
            />
          </label>
          {#if error}
            <p class="text-xs text-rose-600 dark:text-rose-300" role="alert">{error}</p>
          {/if}
          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            class={BUTTON_PRIMARY}
            >{busy ? "Signing in…" : "Sign in"}</button
          >
        </form>
        <button
          type="button"
          on:click={google}
          disabled={busy}
          class={BUTTON_SECONDARY}
          >Continue with Google</button
        >
        <p class="ms-muted text-[0.6875rem]">Same login as the web app.</p>
        <!-- First run: the extension has no sign-up of its own, so both links open the web app's real
             routes: `/signup`, and `/login`, whose "Forgot password?" sends the reset email. -->
        <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
          <a href={`${APP_URL}/signup`} target="_blank" rel="noopener noreferrer" class={LINK_CLASS}>Create an account</a>
          <a
            href={`${APP_URL}/login`}
            target="_blank"
            rel="noopener noreferrer"
            use:tooltip={"Reset it from the web app's sign-in page (opens a new tab)"}
            class={LINK_CLASS}>Forgot password?</a
          >
        </div>
      {/if}
    </div>
  {/if}
</div>

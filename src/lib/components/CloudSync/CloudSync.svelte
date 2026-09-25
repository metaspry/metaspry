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
  import { tooltip } from "../../actions/tooltip";
  import { popover } from "../../actions/popover";
  import { FOCUS_RING } from "../toolbar";
  import {
    initCloudWorkspaces,
    workspaces,
    syncScope,
    setSyncScope,
    type CloudWorkspace,
  } from "../../cloud/workspaces";

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
  });

  async function submit() {
    if (busy || !email.trim() || !password) return;
    busy = true;
    error = "";
    try {
      await cloudSignIn(email.trim(), password);
      password = "";
    } catch {
      error = "Sign-in failed. Use the same email and password as the web app.";
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
      error = e instanceof Error ? e.message : "Google sign-in failed or was cancelled.";
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

  $: isPersonal = $syncScope.kind === "personal";
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
      <span class="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-[10px] font-bold text-white" aria-hidden="true">
        {initials}
        <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900"></span>
      </span>
      <span class="hidden min-w-0 truncate min-[460px]:inline">{targetLabel}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
  {:else}
    <button
      bind:this={trigger}
      type="button"
      on:click={() => (open = !open)}
      aria-expanded={open}
      use:tooltip={"Sign in to sync scans to your account"}
      class="flex h-9 shrink-0 items-center rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm shadow-indigo-500/30 transition hover:bg-indigo-500 {FOCUS_RING}"
    >Sign in</button>
  {/if}

  {#if open}
    <!-- `use:popover`: focus lands on the email field (signed out) or the first item (signed in),
         Escape or a press outside closes, focus returns to the account control. -->
    <div
      use:popover={{ trigger, onClose: close, initialFocus: 'input[type="email"]' }}
      role="dialog"
      aria-label={$cloudUser ? "Account and sync target" : "Sign in"}
      class="absolute right-0 z-50 mt-2 flex w-64 max-w-[calc(100vw-2.5rem)] flex-col gap-2 rounded-xl border border-white/40 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-popover"
    >
      {#if $cloudUser}
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-800 dark:text-slate-100">Synced</p>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">{$cloudUser.email}</p>
          </div>
        </div>

        <button
          type="button"
          on:click={openApp}
          class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-800 transition hover:bg-white/70 dark:text-slate-100 dark:hover:bg-white/10 {FOCUS_RING}"
        >
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>
          </span>
          <span class="min-w-0 flex-1 truncate">Open Metaspry web app</span>
        </button>

        <p class="mt-1 px-0.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
          Save new scans to
        </p>
        <!-- Scrolls past ~6 workspaces instead of pushing Sign out below the fold. -->
        <div class="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          <button
            type="button"
            on:click={pickPersonal}
            class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/70 dark:hover:bg-white/10 {FOCUS_RING} {isPersonal
              ? 'bg-white/70 dark:bg-white/10'
              : ''}"
          >
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </span>
            <span class="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">Personal history</span>
            {#if isPersonal}<span class="text-indigo-500" aria-hidden="true">✓</span>{/if}
          </button>

          {#each $workspaces as w (w.id)}
            <button
              type="button"
              on:click={() => pickWorkspace(w)}
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/70 dark:hover:bg-white/10 {FOCUS_RING} {$syncScope.kind ===
                'workspace' && $syncScope.wsId === w.id
                ? 'bg-white/70 dark:bg-white/10'
                : ''}"
            >
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white" style="background: linear-gradient(135deg,#6a55e0,#9b8bff)">{(w.name[0] ?? "W").toUpperCase()}</span>
              <span class="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{w.name}</span>
              {#if $syncScope.kind === "workspace" && $syncScope.wsId === w.id}<span class="text-indigo-500" aria-hidden="true">✓</span>{/if}
            </button>
          {/each}
        </div>

        <div class="mt-0.5 border-t border-white/40 pt-2 dark:border-white/10">
          <button
            type="button"
            on:click={out}
            class="w-full rounded-full border border-white/40 bg-white/40 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 {FOCUS_RING}"
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
            class="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-50 {FOCUS_RING}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Sign in to save every scan to your history at app.metaspry.com.
        </p>
        <input
          type="email"
          bind:value={email}
          placeholder="you@company.com"
          class="w-full rounded-lg border border-white/40 bg-white/60 px-2.5 py-1.5 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100"
        />
        <input
          type="password"
          bind:value={password}
          placeholder="Password"
          class="w-full rounded-lg border border-white/40 bg-white/60 px-2.5 py-1.5 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100"
          on:keydown={(e) => e.key === "Enter" && submit()}
        />
        {#if error}
          <p class="text-xs text-rose-500">{error}</p>
        {/if}
        <button
          type="button"
          on:click={submit}
          disabled={busy || !email.trim() || !password}
          class="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 {FOCUS_RING}"
          >{busy ? "Signing in…" : "Sign in"}</button
        >
        <button
          type="button"
          on:click={google}
          disabled={busy}
          class="rounded-full border border-white/40 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white/80 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 {FOCUS_RING}"
          >Continue with Google</button
        >
        <p class="text-[11px] text-slate-400 dark:text-slate-500">Same login as the web app.</p>
      {/if}
    </div>
  {/if}
</div>

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
  import { initCloudPlan } from "../../cloud/plan";
  import {
    initCloudWorkspaces,
    workspaces,
    syncScope,
    setSyncScope,
    type CloudWorkspace,
  } from "../../cloud/workspaces";

  let open = false;
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

  function pickPersonal() {
    setSyncScope({ kind: "personal" });
    open = false;
  }
  function pickWorkspace(w: CloudWorkspace) {
    setSyncScope({ kind: "workspace", wsId: w.id, name: w.name });
    open = false;
  }

  $: isPersonal = $syncScope.kind === "personal";
  $: targetLabel = $syncScope.kind === "workspace" ? $syncScope.name : "Personal";
</script>

<div class="relative">
  <!-- Always-visible trigger: shows the current sync target (or "Sync off") -->
  <button
    type="button"
    on:click={() => (open = !open)}
    class="flex h-8 max-w-[150px] items-center gap-1.5 rounded-full border border-white/40 bg-white/40 px-2.5 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
    aria-label="Cloud sync"
  >
    <span
      class="h-2 w-2 shrink-0 rounded-full {$cloudUser ? 'bg-emerald-500' : 'bg-slate-400'}"
      aria-hidden="true"
    ></span>
    {#if $cloudUser}
      <span class="truncate">{targetLabel}</span>
      <span class="shrink-0 text-slate-400" aria-hidden="true">▾</span>
    {:else}
      Sync off
    {/if}
  </button>

  {#if open}
    <!-- click-away backdrop -->
    <button
      type="button"
      class="fixed inset-0 z-40 cursor-default"
      aria-label="Close"
      on:click={() => (open = false)}
    ></button>

    <div
      class="absolute right-0 z-50 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-white/40 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95"
    >
      {#if $cloudUser}
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-800 dark:text-slate-100">Synced</p>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">{$cloudUser.email}</p>
          </div>
        </div>

        <p class="mt-1 px-0.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
          Save new scans to
        </p>
        <div class="flex flex-col gap-0.5">
          <button
            type="button"
            on:click={pickPersonal}
            class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/70 dark:hover:bg-white/10 {isPersonal
              ? 'bg-white/70 dark:bg-white/10'
              : ''}"
          >
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </span>
            <span class="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">Personal history</span>
            {#if isPersonal}<span class="text-indigo-500" aria-hidden="true">✓</span>{/if}
          </button>

          {#each $workspaces as w (w.id)}
            <button
              type="button"
              on:click={() => pickWorkspace(w)}
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/70 dark:hover:bg-white/10 {$syncScope.kind ===
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
            class="w-full rounded-full border border-white/40 bg-white/40 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >Sign out</button
          >
        </div>
      {:else}
        <p class="text-sm font-medium text-slate-800 dark:text-slate-100">Sync scans to the cloud</p>
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
          class="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >{busy ? "Signing in…" : "Sign in"}</button
        >
        <button
          type="button"
          on:click={google}
          disabled={busy}
          class="rounded-full border border-white/40 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white/80 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >Continue with Google</button
        >
        <p class="text-[11px] text-slate-400 dark:text-slate-500">Same login as the web app.</p>
      {/if}
    </div>
  {/if}
</div>

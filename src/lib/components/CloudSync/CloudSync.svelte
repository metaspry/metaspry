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
  import {
    initCloudWorkspaces,
    workspaces,
    syncScope,
    setSyncScope,
  } from "../../cloud/workspaces";

  let open = false;
  let email = "";
  let password = "";
  let busy = false;
  let error = "";

  onMount(() => {
    initCloudAuth();
    initCloudSettingsSync();
    initCloudWorkspaces();
  });

  function onScopeChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    if (v === "personal") {
      setSyncScope({ kind: "personal" });
    } else {
      const ws = $workspaces.find((w) => w.id === v);
      if (ws) setSyncScope({ kind: "workspace", wsId: ws.id, name: ws.name });
    }
  }

  $: scopeValue = $syncScope.kind === "workspace" ? $syncScope.wsId : "personal";
  $: scopeLabel = $syncScope.kind === "workspace" ? $syncScope.name : "your personal history";

  async function submit() {
    if (busy || !email.trim() || !password) return;
    busy = true;
    error = "";
    try {
      await cloudSignIn(email.trim(), password);
      password = "";
      open = false;
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
      open = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Google sign-in failed or was cancelled.";
      console.error("[metaspry] google sign-in", e);
    } finally {
      busy = false;
    }
  }

  async function out() {
    await cloudSignOut();
    open = false;
  }
</script>

<div class="relative">
  <button
    type="button"
    on:click={() => (open = !open)}
    class="flex h-8 items-center gap-1.5 rounded-full border border-white/40 bg-white/40 px-2.5 text-xs font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
    aria-label="Cloud sync"
  >
    <span
      class="h-2 w-2 rounded-full {$cloudUser ? 'bg-emerald-500' : 'bg-slate-400'}"
      aria-hidden="true"
    ></span>
    {$cloudUser ? "Synced" : "Sync"}
  </button>

  {#if open}
    <div
      class="absolute right-0 z-50 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-white/40 bg-white/90 p-3 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95"
    >
      {#if $cloudUser}
        <p class="text-sm font-medium text-slate-800 dark:text-slate-100">Synced to cloud</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {$cloudUser.email}. New scans save to <span class="font-medium">{scopeLabel}</span>.
        </p>
        {#if $workspaces.length > 0}
          <label class="mt-1 flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Sync new scans to
            <span class="relative block">
              <select
                value={scopeValue}
                on:change={onScopeChange}
                class="w-full cursor-pointer appearance-none rounded-lg border border-white/40 bg-white/60 py-1.5 pr-8 pl-2.5 text-sm text-slate-900 shadow-sm transition hover:bg-white/80 focus:border-indigo-400 focus:outline-none dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100"
              >
                <option value="personal">Personal history</option>
                {#each $workspaces as w (w.id)}
                  <option value={w.id}>{w.name}</option>
                {/each}
              </select>
              <svg
                class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </label>
        {/if}
        <button
          type="button"
          on:click={out}
          class="mt-1 rounded-full border border-white/40 bg-white/40 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >Sign out</button
        >
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

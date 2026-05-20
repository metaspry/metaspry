<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import "./app.css";
  import Extension from "../lib/views/Extension.svelte";
  import { initTheme } from "../lib/theme";
  import { initMode } from "../lib/mode";
  import { initSettings } from "../lib/storage/settings";
  import { initPinned } from "../lib/storage/pinned";
  import { initHistory } from "../lib/storage/history";
  import ToastHost from "../lib/components/Toast/ToastHost.svelte";
  import ShortcutsHelp from "../lib/components/Shortcuts/ShortcutsHelp.svelte";
  import { attachShortcuts } from "../lib/components/Shortcuts/keyboard";

  let detach: (() => void) | null = null;

  onMount(() => {
    initTheme();
    initMode();
    initSettings();
    initPinned();
    initHistory();
    detach = attachShortcuts();
  });

  onDestroy(() => {
    detach?.();
  });
</script>

<div
  class="relative h-screen w-full overflow-hidden bg-gradient-to-br from-sky-100 via-indigo-100 to-violet-100 text-slate-900 antialiased dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-slate-100"
>
  <div class="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-violet-300/40 blur-3xl dark:bg-indigo-500/20" />
  <div class="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-sky-300/40 blur-3xl dark:bg-violet-500/20" />
  <div class="relative z-10 h-full w-full">
    <Extension />
  </div>
  <ToastHost />
  <ShortcutsHelp />
</div>

<script lang="ts">
  import { onMount } from "svelte";
  import Screen from "../components/Screen/Screen.svelte";
  import Grid from "../components/Grid/Grid.svelte";
  import type { GridProps } from "../components/Grid/Grid";
  import Tabs, { type TabDef } from "../components/Tabs/Tabs.svelte";
  import TagsView from "../components/Categories/TagsView.svelte";
  import Preview from "../components/Preview/Preview.svelte";
  import Audit from "../components/Audit/Audit.svelte";
  import Skeleton from "../components/Skeleton/Skeleton.svelte";
  import EmptyState from "../components/EmptyState/EmptyState.svelte";
  import ErrorState from "../components/ErrorState/ErrorState.svelte";
  import SettingsDrawer from "../components/Settings/SettingsDrawer.svelte";
  import HistoryDropdown from "../components/History/HistoryDropdown.svelte";
  import CompareView from "../components/Compare/CompareView.svelte";
  import SiteView from "../components/Site/SiteView.svelte";
  import AeoView from "../components/Aeo/AeoView.svelte";

  import { getHTML } from "../scrapers/getHTML";
  import { getMetaTags } from "../scrapers/getMetaTags";
  import type { PageMeta } from "../scrapers/PageMeta";
  import { audit } from "../audit/rules";
  import { resolveAsyncRules } from "../audit/asyncRules";
  import type { AuditResult } from "../audit/AuditResult";

  import { theme, toggleTheme } from "../theme";
  import { mode, setMode, type Mode } from "../mode";
  import { settings, type Settings } from "../storage/settings";
  import { pushHistory } from "../storage/history";
  import { registerShortcuts, helpOpen } from "../components/Shortcuts/keyboard";
  import CloudSync from "../components/CloudSync/CloudSync.svelte";
  import { cloudUser } from "../cloud/auth";
  import { syncScope } from "../cloud/workspaces";
  import { toScanPayload, uploadScan } from "../cloud/sync";
  import { fetchSiteFiles } from "../scrapers/getSiteFiles";
  import { get } from "svelte/store";

  type View = "landing" | "loading" | "error" | "empty" | "results";
  type ActiveTab = "tags" | "previews" | "audit" | "site" | "aeo" | "compare";

  let view: View = "landing";
  let pageMeta: PageMeta | null = null;
  let pageHtml: HTMLElement | null = null;
  let auditResult: AuditResult | null = null;
  let errorMessage = "";
  let activeTab: ActiveTab = "tags";
  let pageUrl = "";
  let settingsOpen = false;

  const tabs: TabDef[] = [
    { id: "tags", label: "Tags" },
    { id: "previews", label: "Previews" },
    { id: "audit", label: "Audit" },
    { id: "site", label: "Site" },
    { id: "aeo", label: "AI" },
    { id: "compare", label: "Compare" },
  ];

  function isPageEmpty(meta: PageMeta): boolean {
    return meta.tags.length === 0 && !meta.title && !meta.canonical && !meta.icon;
  }

  function hostnameOf(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }

  let scrapeId = 0;
  let auditId = 0;

  async function runAudit(meta: PageMeta, currentSettings: Settings, sourceScrapeId: number): Promise<AuditResult> {
    const id = ++auditId;
    const sync = audit(meta, currentSettings);
    if (id === auditId && sourceScrapeId === scrapeId) auditResult = sync;
    if (!sync.hasPending) return sync;
    const resolved = await resolveAsyncRules(sync, meta, currentSettings);
    if (id === auditId && sourceScrapeId === scrapeId) auditResult = resolved;
    return resolved;
  }

  async function scrape() {
    if (view === "loading") return;
    const id = ++scrapeId;
    view = "loading";
    errorMessage = "";
    try {
      const { html, url: tabUrl } = await getHTML();
      if (id !== scrapeId) return;
      if (!html) {
        view = "error";
        errorMessage = "No HTML content returned from the active tab.";
        return;
      }
      const meta = getMetaTags(html, tabUrl);
      if (id !== scrapeId) return;
      pageMeta = meta;
      pageHtml = html;
      pageUrl =
        meta.tags.find((t) => t.key.toLowerCase() === "og:url")?.value ??
        meta.canonical ??
        tabUrl ??
        "";
      if (isPageEmpty(meta)) {
        view = "empty";
        return;
      }
      activeTab = "tags";
      view = "results";
      prevSettings = $settings;
      const finalResult = await runAudit(meta, $settings, id);
      if (id !== scrapeId) return;
      pushHistory({
        url: pageUrl || "(unknown)",
        hostname: hostnameOf(pageUrl),
        title: meta.title ?? "",
        score: finalResult.score,
        timestamp: Date.now(),
      });
      // Cloud sync: if signed in, save this scan to the user's cloud history.
      const cu = get(cloudUser);
      if (cu && pageUrl) {
        try {
          // Best-effort: include site files (robots/sitemap/llms) so the app's Site tab populates.
          let siteFiles;
          try {
            siteFiles = await fetchSiteFiles(new URL(pageUrl).origin);
          } catch {
            siteFiles = undefined;
          }
          await uploadScan(cu.uid, toScanPayload(meta, finalResult, pageUrl, siteFiles), get(syncScope));
        } catch (err) {
          console.warn("cloud sync failed", err);
        }
      }
    } catch (error) {
      if (id !== scrapeId) return;
      view = "error";
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function retry() {
    void scrape();
  }

  let prevSettings: Settings | null = null;
  $: if (pageMeta && view === "results" && $settings !== prevSettings) {
    prevSettings = $settings;
    void runAudit(pageMeta, $settings, scrapeId);
  }

  const items: GridProps[] = [
    {
      text: "Get Meta Tags",
      onClick: () => void scrape(),
    },
  ];

  const modeOptions: { value: Mode; label: string; short: string }[] = [
    { value: "sidepanel", label: "Side panel", short: "Panel" },
    { value: "popup", label: "Popup", short: "Popup" },
  ];

  function isActiveTab(v: string): v is ActiveTab {
    return (
      v === "tags" ||
      v === "previews" ||
      v === "audit" ||
      v === "site" ||
      v === "aeo" ||
      v === "compare"
    );
  }

  function onTabChange(event: CustomEvent<string>) {
    if (isActiveTab(event.detail)) {
      activeTab = event.detail;
    }
  }

  function focusSearch() {
    if (view !== "results") return;
    if (activeTab !== "tags") activeTab = "tags";
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input[data-shortcut="search"]');
      el?.focus();
      el?.select();
    }, 60);
  }

  function selectTabByIndex(idx: number) {
    if (view !== "results") return;
    const tab = tabs[idx];
    if (tab && isActiveTab(tab.id)) activeTab = tab.id;
  }

  // Popup focus-loss hint state. Persisted so a user who's dismissed it
  // doesn't see it again every time the popup opens.
  let popupHintDismissed = false;
  function loadPopupHintDismissed() {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    chrome.storage.local.get('popupHintDismissed', (r) => {
      popupHintDismissed = r.popupHintDismissed === true;
    });
  }
  function dismissPopupHint() {
    popupHintDismissed = true;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ popupHintDismissed: true });
    }
  }

  function onRuntimeMessage(_msg: any) {
    // Reserved for future cross-surface coordination. Mode-switch reopening
    // is handled in switchMode() below, inside the user-gesture click, so
    // chrome.sidePanel.open / chrome.action.openPopup retain gesture context.
  }

  function switchMode(next: Mode) {
    if (next === $mode) return;
    const current = $mode;

    // The click that fired this handler is a valid user gesture. We MUST
    // call chrome.sidePanel.open / chrome.action.openPopup synchronously
    // before any awaits, otherwise Chrome drops the gesture and rejects
    // with "must be called in response to a user gesture".
    try {
      if (next === 'popup') {
        chrome.action.openPopup().catch((err) => console.warn('openPopup:', err));
      } else {
        chrome.windows.getCurrent().then((win) => {
          if (win?.id != null) {
            chrome.sidePanel.open({ windowId: win.id }).catch((err) => console.warn('sidePanel.open:', err));
          }
        });
      }
    } catch (err) {
      console.warn('switchMode open failed:', err);
    }

    // Persist the new mode so background script updates action behavior.
    setMode(next);

    // Close the surface we were in. window.close() works for popup; the
    // side panel doesn't always honor it, but it's safe to call.
    setTimeout(() => {
      try { window.close(); } catch { /* ignore */ }
    }, 50);

    void current;
  }

  onMount(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }
    loadPopupHintDismissed();
    registerShortcuts({
      focusSearch,
      selectTab: selectTabByIndex,
      rescrape: () => void scrape(),
    });
  });
</script>

<div class="flex h-full w-full flex-col p-3">
  <Screen>
    <header class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex shrink-0 items-center gap-2">
        <span class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-md shadow-indigo-500/30">M</span>
        <span class="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">Metaspry</span>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-1.5">
        <div
          role="radiogroup"
          aria-label="Surface mode"
          class="inline-flex h-8 items-center rounded-full border border-white/40 bg-white/40 p-0.5 text-xs font-medium backdrop-blur-md dark:border-white/10 dark:bg-white/5"
        >
          {#each modeOptions as opt}
            <button
              type="button"
              role="radio"
              aria-checked={$mode === opt.value}
              on:click={() => switchMode(opt.value)}
              class="flex h-full items-center rounded-full px-2.5 transition {$mode === opt.value
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
            >
              <span class="hidden min-[400px]:inline">{opt.label}</span>
              <span class="min-[400px]:hidden">{opt.short}</span>
            </button>
          {/each}
        </div>

        <HistoryDropdown />

        <button
          type="button"
          aria-label="Settings"
          on:click={() => (settingsOpen = true)}
          class="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/40 text-slate-700 backdrop-blur-md transition hover:bg-white/70 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-indigo-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <CloudSync />

        <button
          type="button"
          aria-label="Toggle theme"
          on:click={toggleTheme}
          class="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/40 text-slate-700 backdrop-blur-md transition hover:bg-white/70 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-indigo-300"
        >
          {#if $theme === "dark"}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          {/if}
        </button>

        <button
          type="button"
          aria-label="Keyboard shortcuts"
          on:click={() => helpOpen.set(true)}
          class="hidden h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/40 text-slate-700 backdrop-blur-md transition hover:bg-white/70 hover:text-indigo-600 min-[460px]:flex dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-indigo-300"
        >
          <span class="text-sm font-semibold">?</span>
        </button>
      </div>
    </header>

    {#if $mode === 'popup' && !popupHintDismissed}
      <aside
        class="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 backdrop-blur-md dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        role="note"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 flex-shrink-0">
          <path d="M12 9v4M12 17h.01" />
          <circle cx="12" cy="12" r="10" stroke-width="1.5" />
        </svg>
        <span class="flex-1">
          Popup closes when you switch tabs.
          <button
            type="button"
            on:click={() => switchMode('sidepanel')}
            class="font-semibold underline underline-offset-2 hover:opacity-80"
          >Use side panel</button>
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          on:click={dismissPopupHint}
          class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition hover:bg-amber-200/60 dark:hover:bg-amber-500/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </aside>
    {/if}

    {#if view === "landing"}
      <div class="flex flex-col gap-1">
        <h2 class="text-base font-semibold text-slate-900 dark:text-slate-50">What would you like to do?</h2>
        <p class="text-xs text-slate-600 dark:text-slate-400">Select an option below to get started.</p>
      </div>
      <Grid {items} />
    {:else if view === "loading"}
      <Skeleton />
    {:else if view === "error"}
      <ErrorState message={errorMessage} on:retry={retry} />
    {:else if view === "empty"}
      <EmptyState on:retry={retry} />
    {:else if view === "results" && pageMeta && auditResult}
      <Tabs {tabs} active={activeTab} on:change={onTabChange} />
      <div class="flex flex-1 flex-col overflow-y-auto pr-1">
        {#if activeTab === "tags"}
          <TagsView meta={pageMeta} />
        {:else if activeTab === "previews"}
          <Preview meta={pageMeta} {pageUrl} />
        {:else if activeTab === "audit"}
          <Audit result={auditResult} meta={pageMeta} />
        {:else if activeTab === "site"}
          {#key pageUrl}
            <SiteView baseUrl={pageUrl} />
          {/key}
        {:else if activeTab === "aeo"}
          {#key pageUrl}
            <AeoView html={pageHtml} baseUrl={pageUrl} />
          {/key}
        {:else if activeTab === "compare"}
          <CompareView leftMeta={pageMeta} leftUrl={pageUrl} leftScore={auditResult.score} />
        {/if}
      </div>
      <button
        type="button"
        on:click={retry}
        class="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-500 active:scale-[0.99] dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
          <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        Re-scrape this page
      </button>
    {/if}
  </Screen>
</div>

<SettingsDrawer open={settingsOpen} on:close={() => (settingsOpen = false)} />

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

  import { getHTML, unscriptableMessage } from "../scrapers/getHTML";
  import { describeScanError } from "../scrapers/scan-error";
  import { scanUrlFor } from "../cloud/scan-identity";
  import { getMetaTags } from "../scrapers/getMetaTags";
  import { resolveIcon } from "../scrapers/icon";
  import type { PageMeta } from "../scrapers/PageMeta";
  import { audit } from "../audit/rules";
  import { needsAsyncResolution, resolveAsyncRules } from "../audit/asyncRules";
  import type { AuditResult } from "../audit/AuditResult";

  import { theme, toggleTheme } from "../theme";
  import { mode, switchMode } from "../mode";
  import type { Settings } from "../storage/settings";
  import { effectiveSettings } from "../cloud/plan";
  import { pushHistory } from "../storage/history";
  import { registerShortcuts, helpOpen } from "../components/Shortcuts/keyboard";
  import { toolbarButtonClass, TOOLBAR_GROUP, FOCUS_RING } from "../components/toolbar";
  import CloudSync from "../components/CloudSync/CloudSync.svelte";
  import { tooltip } from "../actions/tooltip";
  import { cloudUser } from "../cloud/auth";
  import { syncScope } from "../cloud/workspaces";
  import { toScanPayload, uploadScan, type UploadResult } from "../cloud/sync";
  import { fetchSiteFiles } from "../scrapers/getSiteFiles";
  import { get } from "svelte/store";

  type View = "landing" | "loading" | "error" | "empty" | "results";
  type ActiveTab = "tags" | "previews" | "audit" | "site" | "aeo" | "compare";

  let view: View = "landing";
  let pageMeta: PageMeta | null = null;
  let pageHtml: HTMLElement | null = null;
  let auditResult: AuditResult | null = null;
  // The error card's plain reason and the raw text behind its "Details" (R-37).
  let errorReason = "";
  let errorDetail: string | null = null;
  // Screen-reader announcement of a failed scan (the assertive region below, R-34). Cleared when a
  // scan starts so the same failure twice is announced twice.
  let announcement = "";
  let activeTab: ActiveTab = "tags";
  let pageUrl = "";
  /** What the browser shows as this page's favicon (declared link -> tab icon -> /favicon.ico). */
  let pageIcon: string | null = null;
  // The cloud document this scan wrote: null until the upload resolves, when signed out, or when
  // the upload failed. Drives the Audit tab's "Changed since" row (AGENTS 3.7).
  let cloudScan: UploadResult | null = null;
  $: if (!$cloudUser) cloudScan = null;
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
    // Not `hasPending`: that is true only when an og:image exists, which would skip the
    // X-Robots-Tag check on exactly the bare pages most likely to be header-de-indexed.
    if (!needsAsyncResolution(sync, meta)) return sync;
    const resolved = await resolveAsyncRules(sync, meta, currentSettings);
    if (id === auditId && sourceScrapeId === scrapeId) auditResult = resolved;
    return resolved;
  }

  async function scrape() {
    if (view === "loading") return;
    const id = ++scrapeId;
    view = "loading";
    errorReason = "";
    errorDetail = null;
    announcement = "";
    cloudScan = null;
    try {
      const { html, url: tabUrl, reason, favIconUrl } = await getHTML();
      if (id !== scrapeId) return;
      if (!html) {
        fail(unscriptableMessage(tabUrl, reason), tabUrl ? `Page: ${tabUrl}` : null);
        return;
      }
      const meta = getMetaTags(html, tabUrl);
      if (id !== scrapeId) return;
      // Kept beside `meta`, not inside it: `PageMeta.icon` stays the declared <link>, so the Tags
      // tab, the exports and the empty-page check report only markup that exists. The resolved
      // icon feeds the SERP preview, History and the cloud payload.
      pageIcon = resolveIcon(meta.icon, favIconUrl, tabUrl);
      pageMeta = meta;
      pageHtml = html;
      // Identity is the URL we actually scanned. og:url stays in the payload as metadata: a site
      // that hardcodes it (the very defect this product finds) would otherwise collapse every
      // article into one history row and one overwritten cloud document.
      pageUrl = scanUrlFor(tabUrl, meta.canonical);
      if (isPageEmpty(meta)) {
        view = "empty";
        return;
      }
      activeTab = "tags";
      view = "results";
      prevSettings = $effectiveSettings;
      const finalResult = await runAudit(meta, $effectiveSettings, id);
      if (id !== scrapeId) return;
      pushHistory({
        url: pageUrl || "(unknown)",
        hostname: hostnameOf(pageUrl),
        title: meta.title ?? "",
        score: finalResult.score,
        timestamp: Date.now(),
        ...(pageIcon ? { icon: pageIcon } : {}),
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
          const payloadMeta: PageMeta = { ...meta, icon: pageIcon ?? meta.icon };
          const uploaded = await uploadScan(cu.uid, toScanPayload(payloadMeta, finalResult, pageUrl, siteFiles), get(syncScope));
          // Also dropped when the user signed out (or switched account) while the write was in flight.
          if (id === scrapeId && get(cloudUser)?.uid === cu.uid) cloudScan = uploaded;
        } catch (err) {
          if (import.meta.env.DEV) console.warn("cloud sync failed", err);
        }
      }
    } catch (error) {
      if (id !== scrapeId) return;
      const described = describeScanError(error);
      fail(described.reason, described.detail);
    }
  }

  function fail(reason: string, detail: string | null) {
    errorReason = reason;
    errorDetail = detail;
    view = "error";
    announcement = `Couldn't scan this page. ${reason}`;
  }

  function retry() {
    void scrape();
  }

  let prevSettings: Settings | null = null;
  // Re-score when the effective settings change (Pro edits custom thresholds, or plan flips Pro/free).
  $: if (pageMeta && view === "results" && $effectiveSettings !== prevSettings) {
    prevSettings = $effectiveSettings;
    void runAudit(pageMeta, $effectiveSettings, scrapeId);
  }

  const items: GridProps[] = [
    {
      text: "Scan this page",
      onClick: () => void scrape(),
    },
  ];

  // R-35: the document title names the view, so a screen reader and the tab strip say where you are.
  $: activeTabLabel = tabs.find((t) => t.id === activeTab)?.label ?? "";
  $: documentTitle = view === "results" && activeTabLabel ? `Metaspry - ${activeTabLabel}` : "Metaspry";

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

  // `role="toolbar"` promises arrow-key movement between its buttons (Tab still reaches each one).
  function onToolbarKey(event: KeyboardEvent) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const group = event.currentTarget as HTMLElement;
    const items = Array.from(group.querySelectorAll<HTMLElement>("button:not([disabled])"));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index === -1 || items.length === 0) return;
    event.preventDefault();
    const last = items.length - 1;
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : index === 0 ? last : index - 1;
    items[next]?.focus();
  }

  function onRuntimeMessage(_msg: any) {
    // Reserved for future cross-surface coordination. Mode-switch reopening
    // is handled in `switchMode()` (`src/lib/mode.ts`), inside the user-gesture
    // click, so chrome.sidePanel.open / chrome.action.openPopup retain gesture context.
  }

  onMount(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }
    loadPopupHintDismissed();
    registerShortcuts({
      focusSearch,
      selectTab: selectTabByIndex,
      rescan: () => void scrape(),
    });
  });
</script>

<svelte:head>
  <title>{documentTitle}</title>
</svelte:head>

<!-- Assertive: a failed scan replaces the button that started it, so it is announced here as well as
     by moving focus to the error heading (R-34). -->
<div class="sr-only" aria-live="assertive" aria-atomic="true">{announcement}</div>

<div class="flex h-full w-full flex-col p-3">
  <Screen>
    <!-- Wraps instead of pushing controls off-screen (R2-16): one line at 100 % text from 320 px; at
         200 % text the right-hand block drops below the logo (`ml-auto` keeps it right-aligned) and
         the toolbar group wraps inside itself, so every control stays on screen. -->
    <header class="flex flex-wrap items-center justify-between gap-2">
      <!-- The page's one h1 is the wordmark: visible from 400 px, screen-reader only below (R-35). -->
      <h1 class="flex min-w-0 items-center gap-2">
        <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-md shadow-indigo-500/30" aria-hidden="true">M</span>
        <span class="sr-only shrink-0 text-base font-semibold tracking-tight text-slate-900 min-[400px]:not-sr-only dark:text-slate-50">Metaspry</span>
      </h1>

      <!-- The account control, then one grouped toolbar.
           `relative` here, not on the dropdown components: their menus anchor to this block's
           right edge, so a 256 px menu never runs off the left of a narrow side panel. Nothing
           between this block and the menus may add `backdrop-blur` / `filter` / `transform`
           (see toolbar.ts), or the menu re-anchors to that element and paints under later cards. -->
      <div class="relative ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
        <CloudSync />

        <div role="toolbar" aria-label="Extension controls" tabindex="-1" class={TOOLBAR_GROUP} on:keydown={onToolbarKey}>
          <HistoryDropdown />

          <button
            type="button"
            aria-label="Settings"
            use:tooltip={"Settings"}
            aria-expanded={settingsOpen}
            on:click={() => (settingsOpen = true)}
            class={toolbarButtonClass(settingsOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          <!-- One state model (R-36): a fixed name, "Dark theme", and aria-pressed = dark is on. The
               old name flipped with the state AND carried aria-pressed ("Switch to light theme,
               pressed"). -->
          <button
            type="button"
            aria-label="Dark theme"
            use:tooltip={"Dark theme"}
            aria-pressed={$theme === "dark"}
            on:click={toggleTheme}
            class={toolbarButtonClass($theme === "dark")}
          >
            {#if $theme === "dark"}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            {/if}
          </button>

          <button
            type="button"
            aria-label="Keyboard shortcuts"
            use:tooltip={"Keyboard shortcuts"}
            aria-expanded={$helpOpen}
            on:click={() => helpOpen.set(true)}
            class={toolbarButtonClass($helpOpen)}
          >
            <span class="text-sm font-semibold" aria-hidden="true">?</span>
          </button>
        </div>
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

    <main class="flex min-h-0 flex-1 flex-col gap-4">
    {#if view === "landing"}
      <div class="flex flex-col gap-1">
        <!-- Says what the extension does before asking for a click (R-38). -->
        <h2 class="text-base font-semibold text-slate-900 dark:text-slate-50">Scan this page's meta tags</h2>
        <p class="text-xs ms-muted">Titles, descriptions, Open Graph, Twitter cards, robots and structured data - scored in seconds.</p>
      </div>
      <Grid {items} />
    {:else if view === "loading"}
      <Skeleton />
    {:else if view === "error"}
      <ErrorState reason={errorReason} detail={errorDetail} on:retry={retry} />
    {:else if view === "empty"}
      <EmptyState on:retry={retry} />
    {:else if view === "results" && pageMeta && auditResult}
      <Tabs {tabs} active={activeTab} on:change={onTabChange} />
      <div class="flex flex-1 flex-col overflow-y-auto pr-1">
        {#if activeTab === "tags"}
          <TagsView meta={pageMeta} />
        {:else if activeTab === "previews"}
          <Preview meta={pageMeta} {pageUrl} icon={pageIcon} />
        {:else if activeTab === "audit"}
          <Audit result={auditResult} meta={pageMeta} {cloudScan} />
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
        class="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-700 motion-safe:active:scale-[0.99] dark:bg-indigo-600 dark:hover:bg-indigo-700 {FOCUS_RING}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        Re-scan this page
      </button>
    {/if}
    </main>
  </Screen>
</div>

<SettingsDrawer open={settingsOpen} on:close={() => (settingsOpen = false)} />

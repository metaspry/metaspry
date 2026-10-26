<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import Screen from "../components/Screen/Screen.svelte";
  import Grid from "../components/Grid/Grid.svelte";
  import type { GridProps } from "../components/Grid/Grid";
  import Tabs, { type TabDef } from "../components/Tabs/Tabs.svelte";
  import TagsView from "../components/Categories/TagsView.svelte";
  import Preview from "../components/Preview/Preview.svelte";
  import Audit from "../components/Audit/Audit.svelte";
  import Skeleton from "../components/Skeleton/Skeleton.svelte";
  import ErrorState from "../components/ErrorState/ErrorState.svelte";
  import SettingsDrawer from "../components/Settings/SettingsDrawer.svelte";
  import HistoryDropdown from "../components/History/HistoryDropdown.svelte";
  import CompareView from "../components/Compare/CompareView.svelte";
  import SiteView from "../components/Site/SiteView.svelte";
  import AeoView from "../components/Aeo/AeoView.svelte";
  import SiteIcon from "../components/SiteIcon/SiteIcon.svelte";

  import { getHTML, restrictedKind, unscriptableMessage } from "../scrapers/getHTML";
  import { describeScanError } from "../scrapers/scan-error";
  import { normalizeScanUrl, scanUrlFor } from "../cloud/scan-identity";
  import { displayUrl, followActiveTab, getHostWindowId, hostOf, tabState } from "../tabs/follow-tab";
  import { RESULT_TABS, isResultTab, type ResultTabId } from "../tabs/registry";
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
  import { hasFailingRequired, scoreLabel } from "../audit/band";
  import { registerShortcuts, helpOpen } from "../components/Shortcuts/keyboard";
  import { toolbarButtonClass, TOOLBAR_GROUP, FOCUS_RING, FOCUS_RING_ON_FILL } from "../components/toolbar";
  import CloudSync from "../components/CloudSync/CloudSync.svelte";
  import { tooltip } from "../actions/tooltip";
  import { cloudUser } from "../cloud/auth";
  import { syncScope } from "../cloud/workspaces";
  import { toScanPayload, uploadScan, type UploadResult } from "../cloud/sync";
  import { guardUnload, resetSyncFor, trackUpload } from "../cloud/sync-status";
  import { siteFilesForUpload } from "../scrapers/getSiteFiles";
  import { toast } from "../toast";
  import { modalOpen } from "../layers";
  import { report } from "../diagnostics";
  import { get } from "svelte/store";

  type View = "landing" | "loading" | "error" | "results";
  type ActiveTab = ResultTabId;

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
  // Panels mount on first visit and stay mounted (hidden) until the next scan, so Compare keeps its
  // URL and diff and Tags its search across tab switches (UX review item 10). `scanKey` changes on
  // every committed scan: it remounts Site / AI / Compare and keys the shared site-files fetch.
  let scanKey = 0;
  let visited = new Set<ActiveTab>(["tags"]);
  $: if (!visited.has(activeTab)) visited = new Set([...visited, activeTab]);
  // A page with no meta tags: results open on the Audit tab with this note (item 8).
  let bareNote = false;
  // Polite scan progress for screen readers (item 7): the skeleton is aria-hidden.
  let scanStatus = "";
  let pageUrl = "";
  /** What the browser shows as this page's favicon (declared link -> tab icon -> /favicon.ico). */
  let pageIcon: string | null = null;
  // The cloud document this scan wrote: null until the upload resolves, when signed out, or when
  // the upload failed. Drives the Audit tab's "Changed since" row (AGENTS 3.7).
  let cloudScan: UploadResult | null = null;
  $: if (!$cloudUser) cloudScan = null;
  $: resetSyncFor($cloudUser?.uid ?? null);
  let settingsOpen = false;

  // E-1: the document URL the current scan captured (not `pageUrl`, which can fall back to the
  // canonical), and the URL of this window's active tab (null until first read). Comparing the two
  // flags results that no longer describe the tab; nothing here ever starts a scan.
  let scannedUrl = "";
  // The captured URL with its fragment, for the stale comparison only: a hash-routed SPA's route
  // lives there (`#/pricing` -> `#/blog`), while `scannedUrl` and the scan identity drop it.
  let scannedHref = "";
  let activeUrl: string | null = null;
  // A re-scan from the results view in flight (results stay on screen), and why the last one
  // failed (shown instead of the stale banner until the next scan or tab change).
  let rescanning = false;
  let rescanError: { reason: string; url: string } | null = null;
  $: clearRescanError(activeUrl);
  function clearRescanError(_url: string | null) {
    rescanError = null;
  }
  $: staleState = activeUrl === null ? "same" : tabState(scannedHref, activeUrl);
  $: isStale = staleState !== "same";
  $: canScanTab = staleState === "other" || staleState === "unknown";
  // On a page Chrome is known to block a re-scan can only fail, so it is not offered. Pages the URL
  // check misses are covered by `scrape()` keeping the results when the capture fails.
  $: blockRescan = view === "results" && staleState === "restricted";
  $: scannedLabel = displayUrl(scannedUrl);
  $: showScannedPage = !!scannedUrl && (view === "results" || view === "error");
  $: rescanMessage = rescanError ? rescanNotice(rescanError, scannedLabel) : "";
  function rescanNotice(err: { reason: string; url: string }, label: string): string {
    return `Couldn't scan ${err.url ? displayUrl(err.url) : "this tab"}: ${err.reason} Results are still for ${label}.`;
  }
  $: staleMessage = !showScannedPage || !isStale || rescanError
    ? ""
    : staleState === "restricted"
      ? `This tab is ${restrictedKind(activeUrl ?? "") ?? "a page Chrome blocks"}; Chrome blocks extensions there. Results are for ${scannedLabel}.`
      : staleState === "other"
        ? `This tab changed. Results are for ${scannedLabel}.`
        : "This tab changed.";

  // The one tab list (tabs/registry.ts): the strip, the digit shortcuts and the help read it.
  const tabs: TabDef[] = RESULT_TABS.map((t) => ({ id: t.id, label: t.label }));

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
    if (view === "loading" || rescanning) return;
    const id = ++scrapeId;
    // A re-scan from the results view captures first and replaces the results only once the new
    // page is parsed; a failure leaves them on screen. Every other view clears as before.
    const keep = view === "results";
    // Whether the user was on a control here (a button they pressed, or `r` with focus inside).
    const hadFocus = typeof document !== "undefined" && document.activeElement !== null && document.activeElement !== document.body;
    let committed = false;
    announcement = "";
    scanStatus = "Scanning page…";
    rescanError = null;
    if (keep) {
      rescanning = true;
    } else {
      view = "loading";
      errorReason = "";
      errorDetail = null;
      cloudScan = null;
      scannedUrl = "";
      scannedHref = "";
    }
    try {
      // E-19: capture the active tab of the window hosting this page, not the last-focused one.
      const windowId = await getHostWindowId();
      if (id !== scrapeId) return;
      const { html, url: tabUrl, reason, favIconUrl } = await getHTML(windowId ?? undefined);
      if (id !== scrapeId) return;
      if (!html) {
        if (keep) {
          scanStatus = "";
          keepResults(unscriptableMessage(tabUrl, reason), tabUrl);
          return;
        }
        scannedUrl = normalizeScanUrl(tabUrl);
        scannedHref = tabUrl;
        fail(unscriptableMessage(tabUrl, reason), tabUrl ? `Page: ${tabUrl}` : null);
        return;
      }
      const meta = getMetaTags(html, tabUrl);
      if (id !== scrapeId) return;
      // Commit: from here on the new page replaces the old results.
      committed = true;
      rescanning = false;
      errorReason = "";
      errorDetail = null;
      cloudScan = null;
      scannedUrl = normalizeScanUrl(tabUrl);
      scannedHref = tabUrl;
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
      // A bare page is the case the product exists for: show the audit (what to add) instead of a
      // dead-end "No meta tags found" view whose Try again repeated it.
      bareNote = isPageEmpty(meta);
      activeTab = bareNote ? "audit" : "tags";
      visited = new Set([activeTab]);
      scanKey += 1;
      view = "results";
      // Now, not after the audit and upload: the commit just unmounted the stale banner.
      if (keep && hadFocus) void keepFocus();
      else if (!keep) void focusSelectedTab();
      prevSettings = $effectiveSettings;
      const auditing = runAudit(meta, $effectiveSettings, id);
      // runAudit sets the synchronous result before its first await.
      if (auditResult) scanStatus = scanDoneMessage(auditResult, bareNote);
      const finalResult = await auditing;
      if (id !== scrapeId) return;
      // The og:image / X-Robots-Tag checks can move the score: say the final one (a no-op when equal).
      scanStatus = scanDoneMessage(finalResult, bareNote);
      pushHistory({
        url: pageUrl || "(unknown)",
        hostname: hostnameOf(pageUrl),
        title: meta.title ?? "",
        score: finalResult.score,
        timestamp: Date.now(),
        ...(pageIcon ? { icon: pageIcon } : {}),
        ...(hasFailingRequired(finalResult.rules) ? { requiredFailing: true } : {}),
      });
      // Cloud sync: if signed in, save this scan to the user's cloud history.
      const cu = get(cloudUser);
      if (cu && pageUrl) {
        const scope = get(syncScope);
        const key = scanKey;
        // Tracked, not swallowed (UX review item 1): the account menu shows Saving / Saved / the
        // reason it failed, and a failure toasts. The menu used to say "Synced" whatever happened.
        const out = await trackUpload(scope.kind === "workspace" ? scope.name : "Personal", async () => {
          // Best-effort: include site files (robots/sitemap/llms) so the app's Site tab populates.
          // The same fetch the Site and AI tabs read (one per scan), but a slow site does not hold
          // the upload: after a few seconds the scan is written without them.
          const siteFiles = await siteFilesForUpload(pageUrl, key);
          const payloadMeta: PageMeta = { ...meta, icon: pageIcon ?? meta.icon };
          return uploadScan(cu.uid, toScanPayload(payloadMeta, finalResult, pageUrl, siteFiles), scope);
        });
        // Also dropped when the user signed out (or switched account) while the write was in flight.
        if (out.ok && id === scrapeId && get(cloudUser)?.uid === cu.uid) cloudScan = out.value;
        if (!out.ok) report(out.message, "scan.upload");
        if (!out.ok && get(cloudUser)?.uid === cu.uid) toast(out.message, "error");
      }
    } catch (error) {
      if (id !== scrapeId) return;
      scanStatus = "";
      const described = describeScanError(error);
      if (keep && !committed) {
        keepResults(described.reason, "");
        return;
      }
      fail(described.reason, described.detail);
    } finally {
      if (id === scrapeId) rescanning = false;
      // Kept-results failure: the notice replaced the banner. Success restored focus at the commit.
      if (keep && hadFocus && !committed && id === scrapeId) void keepFocus();
    }
  }

  // A kept-results re-scan swaps the stale banner (and its focused "Scan this tab") for the notice,
  // or the strip for the new page. If that dropped focus to <body>, put it on the re-scan button.
  let rescanButton: HTMLButtonElement | null = null;
  async function keepFocus() {
    await tick();
    if (document.activeElement === null || document.activeElement === document.body) rescanButton?.focus();
  }

  // A re-scan failed before replacing anything: the results stay, and a notice says why.
  function keepResults(reason: string, url: string) {
    rescanError = { reason, url };
    announcement = rescanNotice(rescanError, scannedLabel);
  }

  function scanDoneMessage(result: AuditResult, bare: boolean): string {
    const score = scoreLabel(result.score, result.rules);
    return bare
      ? `Scan complete. No meta tags found. ${score}. The Audit tab lists what to add.`
      : `Scan complete. ${score}.`;
  }

  // A fresh scan unmounts "Scan this page" (focus falls to <body>): put focus on the selected tab
  // so a keyboard or screen-reader user lands on the results (item 7).
  async function focusSelectedTab() {
    await tick();
    const el = document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (document.activeElement === null || document.activeElement === document.body) el?.focus();
  }

  function fail(reason: string, detail: string | null) {
    scanStatus = "";
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
  // The Audit verdict on indexability (meta robots, googlebot, X-Robots-Tag) for the AI tab (item 5).
  $: noindexRule = auditResult?.rules.find((r) => r.id === "noindex") ?? null;
  $: documentTitle = view === "results" && activeTabLabel ? `Metaspry - ${activeTabLabel}` : "Metaspry";

  const isActiveTab = isResultTab;

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
    // The History panel renders inside this toolbar: its own keys are its own (UX review 2026-10-25,
    // Medium 22: arrows from a history row walked out through the toolbar buttons).
    if ((event.target as HTMLElement | null)?.closest('[role="dialog"]')) return;
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

  let stopFollowing: (() => void) | null = null;
  let stopUnloadGuard: (() => void) | null = null;
  let destroyed = false;

  async function startFollowingTab() {
    const windowId = await getHostWindowId();
    if (destroyed || windowId === null || typeof chrome === "undefined" || !chrome.tabs?.onActivated) return;
    stopFollowing = followActiveTab(windowId, (url) => (activeUrl = url));
  }

  onDestroy(() => {
    destroyed = true;
    stopUnloadGuard?.();
    stopFollowing?.();
    stopFollowing = null;
  });

  onMount(() => {
    void startFollowingTab();
    stopUnloadGuard = guardUnload();
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }
    loadPopupHintDismissed();
    registerShortcuts({
      focusSearch,
      selectTab: selectTabByIndex,
      rescan: () => {
        if (!blockRescan) void scrape();
      },
    });
  });
</script>

<svelte:head>
  <title>{documentTitle}</title>
</svelte:head>

<!-- Assertive: a failed scan replaces the button that started it, so it is announced here as well as
     by moving focus to the error heading (R-34). A failed re-scan that keeps the results is announced
     here too, without moving focus. -->
<div class="sr-only" aria-live="assertive" aria-atomic="true">{announcement}</div>
<!-- Polite and always mounted, so the stale-results banner below is announced when it appears or
     changes, without moving focus (E-1). The visible banner carries the "Scan this tab" button. -->
<div class="sr-only" role="status" aria-atomic="true">{staleMessage}</div>
<!-- Scan progress (item 7): "Scanning page...", then the score. Separate from the banner region so
     neither message replaces the other. -->
<div class="sr-only" role="status" aria-atomic="true">{scanStatus}</div>

<!-- Inert behind a modal (Settings, shortcuts help): Tab, clicks and the screen-reader cursor stay
     in the dialog (item 6). The drawer renders outside this block. -->
<div class="flex h-full w-full flex-col p-3" inert={$modalOpen || undefined}>
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
          <HistoryDropdown onScan={() => { if (!blockRescan) void scrape(); }} />

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
        class="ms-note-warn mt-3"
        role="note"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 flex-shrink-0">
          <path d="M12 9v4M12 17h.01" />
          <circle cx="12" cy="12" r="10" stroke-width="1.5" />
        </svg>
        <span class="flex-1">
          Popup closes when you click away or switch tabs.
          <button
            type="button"
            on:click={() => switchMode('sidepanel')}
            class="inline-flex min-h-[1.5rem] items-center rounded font-semibold underline underline-offset-2 hover:opacity-80 {FOCUS_RING}"
          >Use side panel</button>
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          on:click={dismissPopupHint}
          class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition hover:bg-amber-200/60 dark:hover:bg-amber-500/20 {FOCUS_RING}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </aside>
    {/if}

    <!-- Every view but the results scrolls here (R3-10): at 200 % text in a 320 px panel the wrapped
         header pushed "Scan this page" below the fold of the `h-screen overflow-hidden` shell, and a
         pointer could not reach it. `-m-1 p-1` keeps the 4 px focus ring inside the scroll box.
         Results keep their own scroll area between the tabs and Re-scan. -->
    <main class="flex min-h-0 flex-1 flex-col gap-4 {view === 'results' ? '' : '-m-1 overflow-y-auto p-1'}">
    {#if showScannedPage}
      <!-- Names the page these results belong to (E-1). Full host/path/query in the text node, so a
           screen reader reads it whole however much the CSS truncates. -->
      <div class="flex min-w-0 shrink-0 items-center gap-2 text-xs ms-muted">
        <SiteIcon src={view === "error" ? null : pageIcon} hostname={hostOf(scannedUrl)} size={16} />
        <p class="min-w-0 truncate" title={scannedUrl}><span class="sr-only">Results for </span>{scannedLabel}</p>
      </div>
      {#if staleMessage}
        <aside
          aria-label="Results are for another page"
          class="ms-note-warn shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 flex-shrink-0" aria-hidden="true">
            <path d="M12 9v4M12 17h.01" />
            <circle cx="12" cy="12" r="10" stroke-width="1.5" />
          </svg>
          <p class="min-w-0 flex-1 break-words">{staleMessage}</p>
          {#if canScanTab}
            <!-- Stays mounted and focusable while a re-scan runs (aria-disabled, scrape() ignores the
                 click): removing or disabling the focused button would drop focus to <body>. -->
            <button
              type="button"
              on:click={retry}
              aria-disabled={rescanning}
              class="shrink-0 rounded-lg px-2 py-1 font-semibold underline underline-offset-2 hover:bg-amber-200/60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:hover:bg-amber-500/20 {FOCUS_RING}"
            >Scan this tab</button>
          {/if}
        </aside>
      {/if}
      {#if rescanMessage}
        <!-- A re-scan failed and the results were kept. Announced through the assertive region
             above (`announcement`), so this has no live role of its own. -->
        <aside
          aria-label="Scan failed, results kept"
          class="ms-note-warn shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 flex-shrink-0" aria-hidden="true">
            <path d="M12 9v4M12 17h.01" />
            <circle cx="12" cy="12" r="10" stroke-width="1.5" />
          </svg>
          <p class="min-w-0 flex-1 break-words">{rescanMessage}</p>
        </aside>
      {/if}
    {/if}
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
    {:else if view === "results" && pageMeta && auditResult}
      {#if bareNote}
        <aside aria-label="No meta tags found" class="ms-note-warn shrink-0">
          <p>No meta tags found on this page. The Audit tab below lists what to add, required rules first.</p>
        </aside>
      {/if}
      <Tabs {tabs} active={activeTab} on:change={onTabChange} />
      <div class="flex flex-1 flex-col overflow-y-auto pr-1">
        <!-- Keyed on the scan: a new scan remounts every panel (Tags search, Compare, Site / AI fetch). -->
        {#key scanKey}
        {#if visited.has("tags")}
          <div role="tabpanel" id="panel-tags" aria-labelledby="tab-tags" hidden={activeTab !== "tags"}>
            <h2 class="sr-only">{RESULT_TABS.find((t) => t.id === "tags")?.label}</h2>
            <TagsView meta={pageMeta} />
          </div>
        {/if}
        {#if visited.has("previews")}
          <div role="tabpanel" id="panel-previews" aria-labelledby="tab-previews" hidden={activeTab !== "previews"}>
            <h2 class="sr-only">{RESULT_TABS.find((t) => t.id === "previews")?.label}</h2>
            <Preview meta={pageMeta} {pageUrl} icon={pageIcon} />
          </div>
        {/if}
        {#if visited.has("audit")}
          <div role="tabpanel" id="panel-audit" aria-labelledby="tab-audit" hidden={activeTab !== "audit"}>
            <h2 class="sr-only">{RESULT_TABS.find((t) => t.id === "audit")?.label}</h2>
            <Audit result={auditResult} meta={pageMeta} {cloudScan} weights={$effectiveSettings.weights} />
          </div>
        {/if}
        {#if visited.has("site")}
          <div role="tabpanel" id="panel-site" aria-labelledby="tab-site" hidden={activeTab !== "site"}>
            <h2 class="sr-only">{RESULT_TABS.find((t) => t.id === "site")?.label}</h2>
            <SiteView baseUrl={pageUrl} {scanKey} />
          </div>
        {/if}
        {#if visited.has("aeo")}
          <div role="tabpanel" id="panel-aeo" aria-labelledby="tab-aeo" hidden={activeTab !== "aeo"}>
            <h2 class="sr-only">{RESULT_TABS.find((t) => t.id === "aeo")?.label}</h2>
            <AeoView html={pageHtml} baseUrl={pageUrl} {scanKey} indexing={noindexRule ? { blocked: noindexRule.status === "fail", detail: noindexRule.detail } : null} />
          </div>
        {/if}
        {#if visited.has("compare")}
          <div role="tabpanel" id="panel-compare" aria-labelledby="tab-compare" hidden={activeTab !== "compare"}>
            <h2 class="sr-only">{RESULT_TABS.find((t) => t.id === "compare")?.label}</h2>
            <CompareView leftMeta={pageMeta} leftUrl={pageUrl} leftScore={auditResult.score} leftRules={auditResult.rules} />
          </div>
        {/if}
        {/key}
      </div>
      <!-- aria-disabled, not disabled, while re-scanning: this button usually has focus, and disabling
           it would drop focus to <body>. scrape() ignores the click. -->
      <button
        type="button"
        on:click={retry}
        disabled={blockRescan}
        aria-disabled={rescanning}
        aria-busy={rescanning}
        bind:this={rescanButton}
        class="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-700 motion-safe:active:scale-[0.99] dark:bg-indigo-600 dark:hover:bg-indigo-700 {FOCUS_RING_ON_FILL}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        {rescanning ? "Scanning..." : isStale ? "Scan this tab" : "Re-scan this page"}
      </button>
    {/if}
    </main>
  </Screen>
</div>

<SettingsDrawer open={settingsOpen} on:close={() => (settingsOpen = false)} />

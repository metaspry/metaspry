<script lang="ts">
  import type { PageMeta } from '../../scrapers/PageMeta';
  import { getMetaTags } from '../../scrapers/getMetaTags';
  import { audit } from '../../audit/rules';
  import { needsAsyncResolution, resolveAsyncRules } from '../../audit/asyncRules';
  import { effectiveSettings } from '../../cloud/plan';
  import { bandClasses, bandFor, scoreLabel, type BandRule } from '../../audit/band';
  import { tooltip } from '../../actions/tooltip';
  import { diffMeta, differenceCount, DIFF_LABEL, type DiffRow } from './diff';
  import { sameUrl } from '../../audit/url-match';
  import { BUTTON_PRIMARY } from '../button';
  import { report } from '../../diagnostics';
  import { fetchServedHtml } from './fetch-page';

  export let leftMeta: PageMeta;
  export let leftUrl: string;
  export let leftScore: number = 0;
  /** The left side's rule results: a failing required rule caps its band at warn (band.ts). */
  export let leftRules: readonly BandRule[] = [];


  // Pre-fill with the audited page's own URL so first-success is one click
  // away — user typically wants to compare against a previous version or a
  // sibling URL, both of which are easier to derive by editing this than
  // typing from scratch.
  let url = leftUrl ?? '';
  let loading = false;
  let errorMessage = '';
  let rightMeta: PageMeta | null = null;
  let rightUrl = '';
  let rows: DiffRow[] = [];
  let rightScore = 0;
  let rightRules: readonly BandRule[] = [];
  /** True when the left side is the rendered DOM and the right side is served HTML. */
  let mixedSources = false;
  /** The compared URL redirected (often to a sign-in page): the diff is against where it landed. */
  let redirectedTo = '';
  let onlyDifferences = false;
  $: shownRows = onlyDifferences ? rows.filter((r) => r.status !== 'same') : rows;
  $: diffCount = differenceCount(rows);

  // Add a scheme when missing + validate http(s). Lets users paste "example.com".
  function normalizeUrl(raw: string): string | null {
    const t = raw.trim();
    if (!t) return null;
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try {
      const u = new URL(withScheme);
      if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname.includes('.')) return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  /** Parse the served HTML of a URL, or null when it cannot be fetched like-for-like. */
  async function fetchSourceMeta(target: string): Promise<PageMeta | null> {
    if (!target) return null;
    try {
      const { res, text } = await fetchServedHtml(target);
      // No cookies are sent, so an auth-gated page answers with its logged-out or login document.
      // Diffing that against what the user is looking at would be a confident lie.
      if (res.url && !sameUrl(res.url, target)) return null;
      const doc = new DOMParser().parseFromString(text, 'text/html');
      return getMetaTags(doc.documentElement, res.url || target);
    } catch (err) {
      // Falls back to the rendered page (the "mixed sources" note); kept for a bug report.
      report(err, 'compare.served-html');
      return null;
    }
  }

  async function compare() {
    if (loading) return;
    const target = normalizeUrl(url);
    if (!target) {
      errorMessage = 'Enter a valid URL (e.g. example.com).';
      return;
    }
    url = target;
    loading = true;
    errorMessage = '';
    rightMeta = null;
    rows = [];
    redirectedTo = '';
    try {
      const { res, text } = await fetchServedHtml(target);
      const finalUrl = res.url || target;
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const meta = getMetaTags(doc.documentElement, finalUrl);
      rightMeta = meta;
      rightUrl = finalUrl;
      // The left side already refuses a redirected fetch (`fetchSourceMeta`); the compared side used
      // to diff a login page against the user's page without a word (UX review 2026-10-25, Medium 18).
      if (res.url && !sameUrl(res.url, target)) redirectedTo = res.url;
      // Left is the RENDERED DOM of the open tab, right is served HTML. On any SPA that alone
      // produces a wall of false differences, because the framework injects tags after load. Fetch
      // the left page's source too so both sides are the same kind of thing.
      const leftSource = await fetchSourceMeta(leftUrl);
      mixedSources = leftSource === null;
      rows = diffMeta(leftSource ?? leftMeta, meta);
      const initial = audit(meta, $effectiveSettings);
      rightScore = initial.score;
      rightRules = initial.rules;
      if (needsAsyncResolution(initial, meta)) {
        const resolved = await resolveAsyncRules(initial, meta, $effectiveSettings);
        rightScore = resolved.score;
        rightRules = resolved.rules;
      }
    } catch (err) {
      report(err, 'compare.fetch');
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  // A 4 px leading edge in the band hue (>= 3:1 against the card in both themes) plus the text badge:
  // the tint alone was 1.01:1 between "same" and "different".
  function statusEdge(s: DiffRow['status']): string {
    if (s === 'same') return 'border-l-emerald-600 dark:border-l-emerald-400';
    if (s === 'different') return 'border-l-amber-600 dark:border-l-amber-400';
    return 'border-l-slate-500 dark:border-l-slate-400';
  }
  function badgeClass(s: DiffRow['status']): string {
    if (s === 'same') return bandClasses('good').ink;
    if (s === 'different') return bandClasses('warn').ink;
    return 'text-slate-700 dark:text-slate-200';
  }

  // `ink` (-700 / -800), not `text` (-600): at 18 px bold these numbers are not "large text" and the
  // -600 hues were 3.5:1 (emerald) and 4.36:1 (rose).
  const scoreColor = (s: number, rules: readonly BandRule[]): string => bandClasses(bandFor(s, rules)).ink;
</script>

<div class="flex flex-col gap-3">
  <!-- The shared field and the shared primary (K3-03 / C3-10): the hand-rolled pill hovered to
       indigo-500 (white 4.47:1) and had no focus ring. The button stretches to the field's height. -->
  <form on:submit|preventDefault={compare} class="flex gap-2">
    <input
      type="text"
      required
      placeholder="example.com"
      bind:value={url}
      aria-label="URL to compare"
      aria-invalid={errorMessage ? true : undefined}
      aria-describedby={errorMessage ? 'compare-error' : undefined}
      class="ms-input min-w-0 flex-1"
    />
    <!-- aria-disabled, not disabled: the focused button would otherwise drop focus to <body>.
         `compare()` ignores a second press while loading. -->
    <button
      type="submit"
      aria-disabled={loading}
      aria-busy={loading}
      class="{BUTTON_PRIMARY} shrink-0 aria-disabled:opacity-60"
    >{loading ? 'Comparing…' : 'Compare'}</button>
  </form>

  {#if errorMessage}
    <p id="compare-error" role="alert" class="ms-note-error">{errorMessage}</p>
  {/if}

  {#if rightMeta}
    {#if redirectedTo}
      <p class="ms-note-warn" role="status">
        This URL redirected to {redirectedTo}. If that is a sign-in page, the rows below compare against it, not the page you meant.
      </p>
    {/if}
    {#if mixedSources}
      <p
        class="rounded-xl border border-amber-400/40 bg-amber-50/70 px-3 py-2 text-[0.6875rem] text-amber-800 dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-200"
        role="status"
      >
        Could not fetch this page's served HTML, so the left side is the rendered page and the right
        side is served HTML. On a JavaScript-rendered site some differences below may not be real.
      </p>
    {:else}
      <p class="px-1 text-[0.6875rem] ms-muted">
        The rows below compare the served HTML of both pages, fetched without your cookies — tags
        added by JavaScript after load are not included on either side, and a page that varies by
        login or region may differ from what you see. The Current score is your rendered-page audit
        from the Audit tab; the Compared score is an audit of the served HTML.
      </p>
    {/if}
    <div class="grid grid-cols-2 gap-2">
      <!-- Label + url on the left, score on the right of the same card: the shared placement rule. -->
      {#each [{ label: 'Current', url: leftUrl, score: leftScore, rules: leftRules }, { label: 'Compared', url: rightUrl, score: rightScore, rules: rightRules }] as card (card.label)}
        <div class="flex items-center justify-between gap-2 rounded-xl border border-white/40 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <div class="min-w-0 flex-1">
            <p class="text-[0.6875rem] font-semibold uppercase tracking-wider ms-muted">{card.label}</p>
            <p class="truncate text-xs text-slate-700 dark:text-slate-300" use:tooltip={card.url}>{card.url}</p>
          </div>
          <p
            class="shrink-0 text-lg font-bold tabular-nums {scoreColor(card.score, card.rules)}"
            role="img"
            aria-label={scoreLabel(card.score, card.rules)}
            use:tooltip={scoreLabel(card.score, card.rules)}
          >{card.score}</p>
        </div>
      {/each}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 px-1">
      <p class="text-xs text-slate-700 dark:text-slate-200" role="status">
        {diffCount === 0 ? 'No differences.' : `${diffCount} of ${rows.length} tags differ.`}
      </p>
      <label class="inline-flex min-h-6 cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
        <input type="checkbox" bind:checked={onlyDifferences} class="h-4 w-4 accent-indigo-600" />
        Show differences only
      </label>
    </div>

    <!-- Column headings, visible and repeated per cell for screen readers (item 3). -->
    <div class="grid grid-cols-2 gap-2 px-4 text-[0.6875rem] font-semibold uppercase tracking-wider ms-muted" aria-hidden="true">
      <span>Current</span>
      <span>Compared</span>
    </div>
    <ul class="flex flex-col gap-1" aria-label="Tag differences">
      {#each shownRows as row (row.key)}
        <li class="rounded-xl border border-l-4 border-slate-200 bg-white/60 px-3 py-2 text-xs dark:border-slate-700 dark:bg-white/5 {statusEdge(row.status)}">
          <div class="flex items-center justify-between gap-2">
            <p class="font-semibold text-slate-900 dark:text-slate-50 [overflow-wrap:anywhere]">{row.key}</p>
            <span class="shrink-0 text-[0.6875rem] font-semibold {badgeClass(row.status)}">{DIFF_LABEL[row.status]}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <p class="text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300"><span class="sr-only">Current: </span>{row.left ?? '—'}</p>
            <p class="text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300"><span class="sr-only">Compared: </span>{row.right ?? '—'}</p>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

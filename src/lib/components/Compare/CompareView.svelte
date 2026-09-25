<script lang="ts">
  import type { PageMeta } from '../../scrapers/PageMeta';
  import { getMetaTags } from '../../scrapers/getMetaTags';
  import { audit } from '../../audit/rules';
  import { needsAsyncResolution, resolveAsyncRules } from '../../audit/asyncRules';
  import { effectiveSettings } from '../../cloud/plan';
  import { bandClasses, bandFor, scoreLabel } from '../../audit/band';
  import { tooltip } from '../../actions/tooltip';
  import { diffMeta, type DiffRow } from './diff';
  import { sameUrl } from '../../audit/url-match';

  export let leftMeta: PageMeta;
  export let leftUrl: string;
  export let leftScore: number = 0;

  /** Every fetch in this tab is bounded; a host that never answers used to hang it forever. */
  const FETCH_TIMEOUT_MS = 6000;

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
  /** True when the left side is the rendered DOM and the right side is served HTML. */
  let mixedSources = false;

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
    } catch {
      return null;
    }
  }

  /** GET as served HTML, bounded by `FETCH_TIMEOUT_MS` (the body read included). */
  async function fetchServedHtml(target: string): Promise<{ res: Response; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(target, { credentials: 'omit', redirect: 'follow', signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.toLowerCase().includes('text/html')) {
        throw new Error(`Not an HTML page (content-type: ${ct || 'unknown'}).`);
      }
      return { res, text: await res.text() };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Timed out after ${FETCH_TIMEOUT_MS / 1000} s - the site did not answer.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function compare() {
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
    try {
      const { res, text } = await fetchServedHtml(target);
      const finalUrl = res.url || target;
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const meta = getMetaTags(doc.documentElement, finalUrl);
      rightMeta = meta;
      rightUrl = finalUrl;
      // Left is the RENDERED DOM of the open tab, right is served HTML. On any SPA that alone
      // produces a wall of false differences, because the framework injects tags after load. Fetch
      // the left page's source too so both sides are the same kind of thing.
      const leftSource = await fetchSourceMeta(leftUrl);
      mixedSources = leftSource === null;
      rows = diffMeta(leftSource ?? leftMeta, meta);
      const initial = audit(meta, $effectiveSettings);
      rightScore = initial.score;
      if (needsAsyncResolution(initial, meta)) {
        const resolved = await resolveAsyncRules(initial, meta, $effectiveSettings);
        rightScore = resolved.score;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function statusColor(s: DiffRow['status']): string {
    if (s === 'same') return 'border-emerald-300/40 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-950/30';
    if (s === 'different') return 'border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/40';
    return 'border-slate-200/60 bg-slate-50/40 dark:border-slate-700/40 dark:bg-slate-900/20';
  }

  const scoreColor = (s: number): string => bandClasses(bandFor(s)).text;
</script>

<div class="flex flex-col gap-3">
  <form on:submit|preventDefault={compare} class="flex gap-2">
    <input
      type="text"
      required
      placeholder="example.com"
      bind:value={url}
      aria-label="URL to compare"
      class="flex-1 rounded-full border border-slate-500 bg-white/60 px-4 py-2 text-sm text-slate-900 placeholder:text-muted backdrop-blur-md focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 dark:border-white/40 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-muted-dark dark:focus:border-indigo-300"
    />
    <button
      type="submit"
      disabled={loading}
      class="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-500 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >{loading ? '…' : 'Compare'}</button>
  </form>

  {#if errorMessage}
    <p class="rounded-xl border border-rose-300/60 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">{errorMessage}</p>
  {/if}

  {#if rightMeta}
    {#if mixedSources}
      <p
        class="rounded-xl border border-amber-400/40 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-200"
        role="status"
      >
        Could not fetch this page's served HTML, so the left side is the rendered page and the right
        side is served HTML. On a JavaScript-rendered site some differences below may not be real.
      </p>
    {:else}
 <p class="px-1 text-[11px] ms-muted">
        The rows below compare the served HTML of both pages, fetched without your cookies — tags
        added by JavaScript after load are not included on either side, and a page that varies by
        login or region may differ from what you see. The Current score is your rendered-page audit
        from the Audit tab; the Compared score is an audit of the served HTML.
      </p>
    {/if}
    <div class="grid grid-cols-2 gap-2">
      <!-- Label + url on the left, score on the right of the same card: the shared placement rule. -->
      {#each [{ label: 'Current', url: leftUrl, score: leftScore }, { label: 'Compared', url: rightUrl, score: rightScore }] as card (card.label)}
        <div class="flex items-center justify-between gap-2 rounded-xl border border-white/40 bg-white/40 px-3 py-2 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <div class="min-w-0 flex-1">
 <p class="text-[10px] font-semibold uppercase tracking-wider ms-muted">{card.label}</p>
            <p class="truncate text-xs text-slate-700 dark:text-slate-300" use:tooltip={card.url}>{card.url}</p>
          </div>
          <p
            class="shrink-0 text-lg font-bold tabular-nums {scoreColor(card.score)}"
            role="img"
            aria-label={scoreLabel(card.score)}
            use:tooltip={scoreLabel(card.score)}
          >{card.score}</p>
        </div>
      {/each}
    </div>

    <div class="flex flex-col gap-1">
      {#each rows as row (row.key)}
        <div class="rounded-xl border px-3 py-2 text-xs {statusColor(row.status)}">
          <p class="font-semibold text-slate-900 dark:text-slate-50">{row.key}</p>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <p class="break-all text-slate-700 dark:text-slate-300">{row.left ?? '—'}</p>
            <p class="break-all text-slate-700 dark:text-slate-300">{row.right ?? '—'}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

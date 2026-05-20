<script lang="ts">
  import type { AuditResult, RuleResult, RuleSeverity, ScoreBand } from '../../audit/AuditResult';
  import type { PageMeta } from '../../scrapers/PageMeta';
  import CharBar from './CharBar.svelte';
  import JsonLdSection from './JsonLdSection.svelte';
  import HreflangSection from './HreflangSection.svelte';
  import DupTagsSection from './DupTagsSection.svelte';

  export let result: AuditResult;
  export let meta: PageMeta;

  const RADIUS = 32;
  const CIRC = 2 * Math.PI * RADIUS;

  $: dashOffset = CIRC * (1 - result.score / 100);

  const BAND_COLOR: Record<ScoreBand, string> = {
    success: 'text-emerald-500 dark:text-emerald-400',
    warning: 'text-amber-500 dark:text-amber-400',
    danger: 'text-rose-500 dark:text-rose-400',
  };

  const SEVERITY_LABEL: Record<RuleSeverity, string> = {
    required: 'Required',
    recommended: 'Recommended',
    'best-practice': 'Best Practice',
  };

  $: groups = (['required', 'recommended', 'best-practice'] as RuleSeverity[]).map((sev) => ({
    severity: sev,
    label: SEVERITY_LABEL[sev],
    rules: result.rules.filter((r) => r.severity === sev),
  }));

  function statusColor(r: RuleResult): string {
    if (r.status === 'pass') return 'text-emerald-500 dark:text-emerald-400';
    if (r.status === 'warn') return 'text-amber-500 dark:text-amber-400';
    if (r.status === 'pending') return 'text-slate-400 dark:text-slate-500';
    return 'text-rose-500 dark:text-rose-400';
  }
</script>

<div class="flex flex-col gap-4">
  <header class="flex items-center gap-4 rounded-2xl border border-white/40 bg-white/50 p-4 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
    <div class="relative h-20 w-20">
      <svg viewBox="0 0 80 80" class="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={RADIUS} stroke="currentColor" stroke-width="6" fill="none" class="text-slate-200 dark:text-slate-700/50" />
        <circle
          cx="40"
          cy="40"
          r={RADIUS}
          stroke="currentColor"
          stroke-width="6"
          fill="none"
          stroke-linecap="round"
          stroke-dasharray={CIRC}
          stroke-dashoffset={dashOffset}
          class="{BAND_COLOR[result.band]} transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{result.score}</span>
      </div>
    </div>
    <div class="flex flex-1 flex-col">
      <h3 class="text-base font-semibold text-slate-900 dark:text-slate-50">SEO Health</h3>
      <p class="text-xs text-slate-600 dark:text-slate-400">
        {result.hasPending ? 'Resolving async checks…' : 'Score weighted by rule severity.'}
      </p>
    </div>
  </header>

  {#each groups as group}
    {#if group.rules.length > 0}
      <section class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{group.label}</h4>
        <div class="flex flex-col gap-1.5">
          {#each group.rules as rule (rule.id)}
            <div class="flex items-start gap-3 rounded-xl border border-white/40 bg-white/40 px-3 py-2 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
              <div class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center {statusColor(rule)}">
                {#if rule.status === 'pass'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                {:else if rule.status === 'warn'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                    <path d="M12 9v4M12 17h.01" />
                    <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  </svg>
                {:else if rule.status === 'pending'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-4 w-4 animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.2-8.5" />
                  </svg>
                {:else}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-slate-900 dark:text-slate-50">{rule.title}</p>
                <p class="break-all text-xs text-slate-600 dark:text-slate-400">{rule.detail}</p>
                {#if rule.meta?.length !== undefined && rule.meta.min !== undefined && rule.meta.max !== undefined}
                  <div class="mt-1.5">
                    <CharBar length={rule.meta.length} min={rule.meta.min} max={rule.meta.max} />
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/each}

  <JsonLdSection jsonLd={meta.jsonLd} />
  <HreflangSection hreflang={meta.hreflang} />
  <DupTagsSection tags={meta.tags} />
</div>

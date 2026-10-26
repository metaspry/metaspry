<script lang="ts">
  import type { MetaTag, PageMeta } from '../../scrapers/PageMeta';
  import DiscordPreview from '../Previews/DiscordPreview.svelte';
  import SlackPreview from '../Previews/SlackPreview.svelte';
  import SerpPreview from '../Previews/SerpPreview.svelte';
  import MessagingPreview from '../Previews/MessagingPreview.svelte';
  import { probeImage, type ImageState } from './image-probe';

  export let meta: PageMeta;
  export let pageUrl: string = '';
  /** The page icon the browser shows (resolved with fallbacks); `meta.icon` is only the declared link. */
  export let icon: string | null = null;

  function find(key: string): MetaTag | undefined {
    const lower = key.toLowerCase();
    return meta.tags.find((t) => t.key.toLowerCase() === lower);
  }

  function val(key: string): string | undefined {
    return find(key)?.value;
  }

  function hostnameOf(...candidates: (string | undefined | null)[]): string {
    for (const c of candidates) {
      if (!c) continue;
      try {
        return new URL(c).hostname.toUpperCase();
      } catch {
        // skip
      }
    }
    return '';
  }

  function safeImage(raw: string | undefined): string | null {
    if (!raw) return null;
    try {
      const u = new URL(raw, pageUrl || undefined);
      return u.toString();
    } catch {
      return null;
    }
  }

  $: ogTitle = val('og:title') ?? meta.title ?? '(no title)';
  $: ogDescription = val('og:description') ?? val('description') ?? '';
  $: ogImage = safeImage(val('og:image'));
  $: ogHost = hostnameOf(val('og:url'), meta.canonical, pageUrl);

  // Without twitter:card, X falls back to a plain summary — not summary_large_image. Defaulting
  // to the big card showed the user a preview they will never actually get.
  $: declaredTwitterCard = val('twitter:card')?.toLowerCase() ?? null;
  $: twitterCard = declaredTwitterCard ?? 'summary';
  $: twitterTitle = val('twitter:title') ?? ogTitle;
  $: twitterDescription = val('twitter:description') ?? ogDescription;
  $: twitterImage = safeImage(val('twitter:image') ?? val('og:image') ?? undefined);

  $: serpHost = hostnameOf(meta.canonical, pageUrl).toLowerCase();
  $: serpCanonical = meta.canonical ?? pageUrl;

  // One probe per URL (image-probe.ts): a dead image is said to be dead, not drawn as a placeholder.
  let states: Record<string, ImageState> = {};
  function watch(url: string | null) {
    if (!url || states[url]) return;
    states = { ...states, [url]: 'loading' };
    void probeImage(url).then((s) => (states = { ...states, [url]: s }));
  }
  $: watch(ogImage);
  $: watch(twitterImage);
  $: ogFailed = !!ogImage && states[ogImage] === 'failed';
  $: twitterFailed = !!twitterImage && states[twitterImage] === 'failed';
  $: ogShown = ogFailed ? null : ogImage;
  $: twitterShown = twitterFailed ? null : twitterImage;

  $: missingOgImage = !ogImage;
  $: missingOgDesc = !ogDescription;
</script>

<div class="flex flex-col gap-4">
  {#if ogFailed || (twitterFailed && twitterImage !== ogImage)}
    <div class="ms-note-warn" role="status">
      <p class="min-w-0 [overflow-wrap:anywhere]">
        {ogFailed ? 'og:image' : 'twitter:image'} didn't load ({ogFailed ? ogImage : twitterImage}). Platforms that can't fetch it show the card without an image.
      </p>
    </div>
  {/if}
  {#if missingOgImage || missingOgDesc}
    <div class="rounded-2xl border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
      {#if missingOgImage}<p>Add <code class="rounded bg-amber-100/60 px-1 dark:bg-amber-500/10">og:image</code> to render images in previews.</p>{/if}
      {#if missingOgDesc}<p>Add <code class="rounded bg-amber-100/60 px-1 dark:bg-amber-500/10">og:description</code> to fill description text.</p>{/if}
    </div>
  {/if}

  <!-- Facebook -->
  <section
    aria-label="Facebook preview"
    class="overflow-hidden rounded-2xl border border-white/40 bg-white/60 shadow-md shadow-indigo-500/5 dark:border-white/10 dark:bg-white/5"
  >
    <header class="border-b border-white/40 px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider ms-muted dark:border-white/10">
      Facebook
    </header>
    <div class="aspect-[1.91/1] w-full bg-gradient-to-br from-indigo-200 to-violet-200 dark:from-indigo-900/40 dark:to-violet-900/40">
      {#if ogShown}
        <img src={ogShown} alt="" class="h-full w-full object-cover" loading="lazy" referrerpolicy="no-referrer" />
      {:else}
        <div class="flex h-full w-full items-center justify-center text-xs text-slate-600 dark:text-slate-300">{ogFailed ? 'og:image failed to load' : 'no og:image'}</div>
      {/if}
    </div>
    <div class="space-y-1 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/40">
      <p class="text-[0.6875rem] font-medium uppercase tracking-wider ms-muted">{ogHost}</p>
      <p class="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{ogTitle}</p>
      <p class="line-clamp-2 text-xs ms-muted">{ogDescription}</p>
    </div>
  </section>

  <!-- Twitter -->
  <section
    aria-label="Twitter preview"
    class="overflow-hidden rounded-2xl border border-white/40 bg-white/60 shadow-md shadow-indigo-500/5 dark:border-white/10 dark:bg-white/5"
  >
    <header class="border-b border-white/40 px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider ms-muted dark:border-white/10">
      Twitter · {twitterCard}{declaredTwitterCard ? '' : ' (no twitter:card — fallback)'}
    </header>
    {#if twitterCard === 'summary'}
      <div class="flex">
        <div class="h-24 w-24 flex-shrink-0 bg-gradient-to-br from-sky-200 to-indigo-200 dark:from-sky-900/40 dark:to-indigo-900/40">
          {#if twitterShown}
            <img src={twitterImage} alt="" class="h-full w-full object-cover" loading="lazy" referrerpolicy="no-referrer" />
          {:else}
            <div class="flex h-full w-full items-center justify-center text-[0.6875rem] text-slate-600 dark:text-slate-300">no image</div>
          {/if}
        </div>
        <div class="min-w-0 flex-1 space-y-1 px-3 py-2">
          <p class="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{twitterTitle}</p>
          <p class="line-clamp-2 text-xs ms-muted">{twitterDescription}</p>
          <p class="text-[0.6875rem] ms-muted">{ogHost}</p>
        </div>
      </div>
    {:else}
      <div class="aspect-[2/1] w-full bg-gradient-to-br from-sky-200 to-indigo-200 dark:from-sky-900/40 dark:to-indigo-900/40">
        {#if twitterShown}
          <img src={twitterImage} alt="" class="h-full w-full object-cover" loading="lazy" referrerpolicy="no-referrer" />
        {:else}
          <div class="flex h-full w-full items-center justify-center text-xs text-slate-600 dark:text-slate-300">no twitter/og image</div>
        {/if}
      </div>
      <div class="space-y-1 px-4 py-3">
        <p class="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{twitterTitle}</p>
        <p class="line-clamp-2 text-xs ms-muted">{twitterDescription}</p>
        <p class="text-[0.6875rem] ms-muted">{ogHost}</p>
      </div>
    {/if}
  </section>

  <!-- LinkedIn -->
  <section
    aria-label="LinkedIn preview"
    class="overflow-hidden rounded-2xl border border-white/40 bg-white/60 shadow-md shadow-indigo-500/5 dark:border-white/10 dark:bg-white/5"
  >
    <header class="border-b border-white/40 px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider ms-muted dark:border-white/10">
      LinkedIn
    </header>
    <div class="aspect-[1.91/1] w-full bg-gradient-to-br from-sky-200 to-indigo-200 dark:from-sky-900/40 dark:to-indigo-900/40">
      {#if ogShown}
        <img src={ogShown} alt="" class="h-full w-full object-cover" loading="lazy" referrerpolicy="no-referrer" />
      {:else}
        <div class="flex h-full w-full items-center justify-center text-xs text-slate-600 dark:text-slate-300">{ogFailed ? 'og:image failed to load' : 'no og:image'}</div>
      {/if}
    </div>
    <div class="space-y-1 bg-slate-50/80 px-4 py-3 dark:bg-slate-900/40">
      <p class="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{ogTitle}</p>
      <p class="line-clamp-2 text-xs ms-muted">{ogDescription}</p>
      <p class="text-[0.6875rem] ms-muted">{ogHost}</p>
    </div>
  </section>

  <DiscordPreview title={ogTitle} description={ogDescription} image={ogShown} host={ogHost} />
  <SlackPreview title={ogTitle} description={ogDescription} image={ogShown} host={ogHost} />
  <SerpPreview title={meta.title ?? ogTitle} description={val('description') ?? ogDescription} host={serpHost} canonical={serpCanonical} icon={icon ?? meta.icon} />
  <MessagingPreview title={ogTitle} description={ogDescription} image={ogShown} host={ogHost} />
</div>

<script lang="ts">
  /**
   * A page's favicon, with a letter tile when there is none or it fails to load. The tile means a
   * dead icon URL never leaves a broken-image glyph in the SERP preview or a History row.
   */
  import { isHttpUrl } from '../../scrapers/icon';

  /** http(s) icon URL; anything else (null, undefined, data:, chrome:) renders the tile. */
  export let src: string | null | undefined = null;
  export let hostname: string;
  /** Rendered box in px. */
  export let size = 20;

  let failedSrc: string | null = null;

  $: showImg = isHttpUrl(src) && failedSrc !== src;
  $: letter = (hostname.replace(/^www\./i, '').charAt(0) || '?').toUpperCase();
  $: fontPx = Math.max(9, Math.round(size * 0.5));
</script>

{#if showImg}
  <img
    {src}
    alt=""
    width={size}
    height={size}
    loading="lazy"
    decoding="async"
    referrerpolicy="no-referrer"
    class="shrink-0 rounded-full object-cover"
    style="width:{size}px;height:{size}px"
    on:error={() => (failedSrc = src ?? null)}
  />
{:else}
  <span
    aria-hidden="true"
    class="inline-flex shrink-0 select-none items-center justify-center rounded-full bg-indigo-500/20 font-semibold leading-none text-indigo-600 dark:text-indigo-300"
    style="width:{size}px;height:{size}px;font-size:{fontPx}px">{letter}</span
  >
{/if}

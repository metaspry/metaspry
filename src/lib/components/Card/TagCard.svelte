<script lang="ts">
  import type { MetaTag } from '../../scrapers/PageMeta';
  import { toast } from '../Toast/toast';
  import PinButton from './PinButton.svelte';
  import UrlValue from './UrlValue.svelte';

  export let tag: MetaTag;

  function copy() {
    navigator.clipboard.writeText(tag.value).then(() => {
      toast(`Copied ${tag.key}`, 'success');
    });
  }
</script>

<div
  class="relative flex min-w-[160px] flex-grow flex-shrink flex-col gap-1 rounded-2xl border border-white/40 bg-white/50 p-4 pr-16 shadow-md shadow-indigo-500/5 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
>
  <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 break-all dark:text-slate-400">
    {tag.key}
  </p>
  <UrlValue value={tag.value} />
  <div class="absolute right-1 top-1 flex items-center gap-0.5">
    <PinButton tagKey={tag.key} />
    <button
      on:click={copy}
      aria-label="Copy value"
      class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/60 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-indigo-300"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
      </svg>
    </button>
  </div>
</div>

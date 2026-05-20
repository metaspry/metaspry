<script lang="ts">
  export let value: string;

  const MAX = 240;

  $: isUrl = /^https?:\/\//i.test(value.trim());
  $: long = value.length > MAX;

  let expanded = false;

  $: shown = !long || expanded ? value : `${value.slice(0, MAX)}…`;
</script>

{#if isUrl}
  <a
    href={value}
    target="_blank"
    rel="noopener noreferrer"
    class="break-all text-sm text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
  >{shown}</a>
{:else}
  <span class="break-all text-sm text-slate-900 dark:text-slate-100">{shown}</span>
{/if}
{#if long}
  <button
    type="button"
    on:click={() => (expanded = !expanded)}
    class="ml-1 inline text-[10px] font-medium text-indigo-600 hover:underline dark:text-indigo-300"
  >{expanded ? 'Show less' : 'Show more'}</button>
{/if}

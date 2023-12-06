<script>
  import { fade } from 'svelte/transition';
  import ScreenInfo from '../ScreenInfo/ScreenInfo.svelte';

  export let metaTags = {};
  let copied = false;
  let copiedKey = '';

  let container;
  // calculate max height of container
  // to prevent it from overflowing the screen
  const calculateMaxHeight = () => {
    if (container) {
      const height = window.innerHeight;
      const top = container.getBoundingClientRect().top;
      const maxHeight = height - top - 14.5;
      return maxHeight;
    }
  };

  $: container && (container.style.maxHeight = `${calculateMaxHeight()}px`);

  const copyTag = (value) => {
    navigator.clipboard.writeText(value).then(() => {
      copied = true;
      copiedKey = value;
      setTimeout(() => {
        copied = false;
      }, 1000);
    }).catch((error) => {
      console.error('Copy failed:', error);
    });
  };
</script>

<ScreenInfo title="Meta Tags Information">
  {#each Object.entries(metaTags) as [key, value]}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="border-[0.5px] bg-gray-100 border-gray-200 rounded-2xl p-4 flex-grow flex-shrink min-w-[160px] relative">
      <div class="h-full flex flex-col">
        <div class="flex-1">
          {#if copied && copiedKey === value}
            <div class="absolute inset-0 bg-gray-100 rounded-2xl bg-opacity-100 flex items-center justify-center z-10">
              <p transition:fade class="text-xl text-gray-600">Copied!</p>
            </div>
          {/if}
          <p class="text-sm text-gray-600 break-all">{key}</p>
          <p class="text-sm text-gray-600 break-all">{value}</p>
        </div>
        <button
          on:click={() => copyTag(value)}
          class="absolute top-2 right-2 bg-gray-400 text-white p-1 rounded cursor-pointer flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
          </svg>
        </button>
      </div>
    </div>
  {/each}
</ScreenInfo>
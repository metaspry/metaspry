<script lang="ts">
  import type { GridProps } from './Grid.ts';
 
  export let items: GridProps[] = [];
</script>
<div class="flex flex-row flex-wrap gap-4">
  {#each items as item}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div on:click={item.onClick}
      class="{item.cssClass} 
      border-[0.5px] border-gray-200 rounded-2xl p-4 flex-grow flex-shrink min-w-[160px] cursor-pointer
      hover:shadow-md transition-shadow duration-300 ease-in-out hover:bg-gray-50
      active:shadow-inner active:bg-gray-100 active:scale-95 active:duration-200 active:ease-in-out
      ">
      <div class="h-full flex flex-col">
        <div class="flex-1">
          {#if item.number}
            <p class="text-2xl text-black font-medium">{item.number}</p>
          {/if}
          <p class="text-sm text-gray-600">{item.text}</p>
        </div>
      </div>
    </div>
  {/each}
</div>
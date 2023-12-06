<script lang="ts">
  export let title: string = '';
  
  let container: HTMLDivElement;
  const calculateMaxHeight = (): number => {
    // calculate the max height of the container
    // to prevent it from overflowing the screen
    if (container) {
      const height = window.innerHeight;
      const top = container.getBoundingClientRect().top;
      const maxHeight = height - top - 14.5;
      return maxHeight;
    }
    return 0; // default return value
  };

  $: container && (container.style.maxHeight = `${calculateMaxHeight()}px`);
</script>

<h2 class="text-xl font-medium my-4">{title}</h2>
<div bind:this={container} class="flex flex-wrap gap-4 overflow-y-auto">
  <slot></slot>
</div>
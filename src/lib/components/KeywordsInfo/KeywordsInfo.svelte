<script lang="ts">
  import ScreenInfo from '../ScreenInfo/ScreenInfo.svelte';
  import type { Keywords } from './Keywords.ts';

  export let keywords = [] as Keywords[];
</script>

<ScreenInfo title="Extracted Keywords">
  <ul>
    {#each keywords as keyword}
      <li>{keyword.keyword}:{keyword.count}</li>
    {/each}
  </ul>
</ScreenInfo>
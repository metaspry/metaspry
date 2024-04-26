
<script lang="ts">
  import { onMount } from "svelte";
  
  import Screen from "../components/Screen/Screen.svelte";
  import Grid from '../components/Grid/Grid.svelte';
  import type { GridProps } from "../components/Grid/Grid";
  import MetaInfo from "../components/MetaInfo/MetaInfo.svelte";
  import type { MetaTags } from "../components/MetaInfo/MetaTags";
  import KeywordsInfo from "../components/KeywordsInfo/KeywordsInfo.svelte";
  import type { Keywords } from "../components/KeywordsInfo/Keywords";
  
  // scrapers
  import { getHTML } from "../scrapers/getHTML";
  import { getMetaTags } from "../scrapers/getMetaTags";
  import { guessKeywordsGPT } from "../gpt-actions/guessKeywordsGPT";
  
  let metaTags = {} as MetaTags;
  let keywords = [] as Keywords[];

  let showScreenIndex: number = 0;

  let items: GridProps[] = [
    {
      text: "Get Meta Tags",
      async onClick() {
        try {
          const htmlElement = await getHTML();
          if (htmlElement) {
            const metas = await getMetaTags(htmlElement);
            metaTags = metas;
            showScreenIndex = 1;
          } else {
            console.error("HTML content not found");
          }
        } catch (error) {
          console.error("Error fetching HTML or meta tags:", error);
        }
      },
    },
    {
      cssClass: "bg-gray-100",
      text: "Guess Keywords with GPT (Beta)",
      async onClick () {
        const htmlElement = await getHTML();
        if (htmlElement) {
          await guessKeywordsGPT(htmlElement);;
        } else {
          console.error("HTML content not found");
        }
      },
    },
  ];
  
  $: windowUrl = metaTags['og:url'] || metaTags['url'] || '';
</script>

<div class="p-4 text-xl text-center w-full">
  Meta Tag Analyzer
</div>
<div class="h-full shadow-[rgba(13,_38,_76,_0.19)_0px_9px_20px]">
  <Screen>
    <h2 class="text-xl text-gray-600 pb-2">What would you like to do?</h2>
    <h3 class="text-sm text-gray-400 pb-4">Select an option below to get started</h3>
    <h3 class="text-sm text-gray-400 pb-4">URL: {windowUrl}</h3>
    <Grid items={items} />
    {#if showScreenIndex === 1}
      <MetaInfo {metaTags} />
    {/if}
    {#if showScreenIndex === 2}
      <KeywordsInfo {keywords} />
    {/if}
  </Screen>
</div>
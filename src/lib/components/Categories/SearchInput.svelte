<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value: string = '';
  export let placeholder: string = 'Search tags...';

  const dispatch = createEventDispatcher<{ input: string }>();

  function handle(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    dispatch('input', value.trim());
  }
</script>

<label class="relative block">
  <span class="sr-only">Search</span>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ms-muted"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
  <input
    type="text"
    data-shortcut="search"
    {value}
    on:input={handle}
    {placeholder}
    class="w-full rounded-full border border-slate-500 bg-white/60 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-muted backdrop-blur-md transition focus:border-indigo-600 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 dark:border-white/40 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-muted-dark dark:focus:border-indigo-300 dark:focus:bg-white/10"
  />
</label>

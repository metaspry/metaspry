import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    // happy-dom gives the scraper tests a real DOMParser/querySelector, which is the whole point
    // of E6 (title scoping), E9 (duplicate canonical) and E10 (base href).
    environment: 'happy-dom',
  },
});

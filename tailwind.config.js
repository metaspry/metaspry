/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // The one dark floating tint (History, account popover, Settings drawer, help, toast).
        // Mirrors the web app's `--color-popover-dark`.
        popover: '#2a2159',
      },
    },
  },
  plugins: [],
}

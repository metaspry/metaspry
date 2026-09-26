/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // The one dark floating tint (History, account popover, Settings drawer, help).
        // Mirrors the web app's `--color-popover-dark`.
        popover: '#2a2159',
        // Secondary text (captions, section labels, placeholders, idle icons). Light is slate-600
        // (6.71:1 on the light Screen, 7.58:1 on white), dark is slate-400 (5.61:1 on `popover`).
        // Mirrors the web app's `ms-muted`. Use the `.ms-muted` class (app.css) for text; the raw
        // `text-muted` / `dark:text-muted-dark` pair only where a variant needs it (placeholder:,
        // marker:). The -400/-500 pair it replaced measured 2.27:1 and 3.02:1.
        muted: {
          DEFAULT: '#475569',
          dark: '#94a3b8',
        },
      },
    },
  },
  plugins: [],
}

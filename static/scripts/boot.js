// Runs in <head>, before first paint (UX review item 11). The theme and surface mode live in
// chrome.storage, which is async, so the page used to paint light and narrow and then flip: every
// open flashed white for dark-mode users and the popup snapped from shrink-to-fit to 720px.
// theme.ts and mode.ts mirror both values into localStorage, which is synchronous; this applies
// them (theme falls back to the OS preference). An external file, not inline: MV3's CSP blocks
// inline scripts (removeInlineScript.cjs).
(function () {
  try {
    var root = document.documentElement;
    var theme = localStorage.getItem('metaspry:theme');
    if (theme !== 'dark' && theme !== 'light') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme === 'dark') root.classList.add('dark');
    root.dataset.mode = localStorage.getItem('metaspry:mode') === 'popup' ? 'popup' : 'sidepanel';
  } catch (e) {
    // Storage blocked: theme.ts / mode.ts apply the values once chrome.storage answers.
  }
})();

import { describe, it, expect } from 'vitest';
import { unscriptableMessage } from './getHTML';

describe('unscriptableMessage', () => {
  it('names a browser settings page', () => {
    expect(unscriptableMessage('chrome://extensions')).toContain('browser settings page');
  });

  it('names the Web Store', () => {
    expect(unscriptableMessage('https://chromewebstore.google.com/detail/x')).toContain('Chrome Web Store');
  });

  it('names a PDF', () => {
    expect(unscriptableMessage('https://acme.com/report.pdf')).toContain('PDF');
  });

  it('names the new tab page for an about: URL', () => {
    expect(unscriptableMessage('about:newtab')).toContain('new tab page');
  });

  it('says there is no tab, rather than blaming the new tab page', () => {
    const msg = unscriptableMessage('', 'no-tab');
    expect(msg).toContain('No active tab');
    expect(msg).not.toContain('new tab page');
  });

  it('stays generic for an unknown page with no URL', () => {
    const msg = unscriptableMessage('');
    expect(msg).toContain("can't be scanned");
    expect(msg).not.toContain('new tab page');
  });

  it('falls back to a plain explanation for a normal URL', () => {
    const msg = unscriptableMessage('https://acme.com/');
    expect(msg).toContain("can't be scanned");
    expect(msg).not.toContain('background script');
  });

  it('never mentions our plumbing', () => {
    for (const u of ['chrome://newtab', 'file:///c:/x.html', 'https://acme.com/']) {
      expect(unscriptableMessage(u)).not.toMatch(/background script|sendResponse/);
    }
  });
});

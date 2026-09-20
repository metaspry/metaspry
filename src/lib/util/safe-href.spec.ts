import { describe, it, expect } from 'vitest';
import { safeHref } from './safe-href';

describe('safeHref', () => {
	it('allows http and https', () => {
		expect(safeHref('https://acme.com/sitemap.xml')).toBe('https://acme.com/sitemap.xml');
		expect(safeHref('http://acme.com/')).toBe('http://acme.com/');
	});

	it('refuses javascript: URLs', () => {
		// These arrive from the audited site's robots.txt, sitemap or llms.txt and are rendered
		// inside the extension's own page, so a clickable javascript: URL is not acceptable.
		expect(safeHref('javascript:alert(1)')).toBeNull();
		expect(safeHref('JaVaScRiPt:alert(1)')).toBeNull();
	});

	it('refuses data:, file: and other schemes', () => {
		for (const bad of ['data:text/html,<h1>x', 'file:///etc/passwd', 'chrome://settings']) {
			expect(safeHref(bad), bad).toBeNull();
		}
	});

	it('refuses relative and unparseable values', () => {
		expect(safeHref('/sitemap.xml')).toBeNull();
		expect(safeHref('not a url')).toBeNull();
	});

	it('refuses empty and non-string input', () => {
		expect(safeHref('')).toBeNull();
		expect(safeHref('   ')).toBeNull();
		expect(safeHref(null)).toBeNull();
		expect(safeHref(42)).toBeNull();
	});

	it('trims surrounding whitespace', () => {
		expect(safeHref('  https://acme.com/  ')).toBe('https://acme.com/');
	});
});

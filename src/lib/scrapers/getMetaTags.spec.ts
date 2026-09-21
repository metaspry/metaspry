import { describe, it, expect } from 'vitest';
import { getMetaTags } from './getMetaTags';

// Parses real HTML through the same DOMParser the extension uses (happy-dom environment), because
// these three defects are about real querySelector semantics, not about our own parsing.
const maybe = describe;

function parse(html: string, url = 'https://acme.com/blog/post') {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	return getMetaTags(doc.documentElement, url);
}

maybe('title scoping (E6)', () => {
	it('ignores an inline SVG title in the body', () => {
		// An SVG <title> is an accessible name for an icon. It used to satisfy the required
		// page-title rule on a page with no <title> at all.
		const meta = parse(
			'<html><head></head><body><svg><title>icon label</title></svg></body></html>'
		);
		expect(meta.title).toBeNull();
	});

	it('reads the head title', () => {
		expect(parse('<html><head><title>Real title</title></head><body></body></html>').title).toBe(
			'Real title'
		);
	});

	it('counts duplicate head titles', () => {
		const meta = parse('<html><head><title>One</title><title>Two</title></head><body></body></html>');
		expect(meta.duplicates.title).toBe(2);
		expect(meta.title).toBe('One');
	});
});

maybe('base href (E10)', () => {
	it('resolves a relative canonical against <base href>', () => {
		const meta = parse(
			'<html><head><base href="https://cdn.acme.com/site/"><link rel="canonical" href="page"></head><body></body></html>'
		);
		expect(meta.canonical).toBe('https://cdn.acme.com/site/page');
	});

	it('falls back to the page URL when there is no base', () => {
		const meta = parse(
			'<html><head><link rel="canonical" href="/other"></head><body></body></html>'
		);
		expect(meta.canonical).toBe('https://acme.com/other');
	});
});

maybe('duplicate structural tags (E9)', () => {
	it('counts duplicate canonical links', () => {
		const meta = parse(
			'<html><head><link rel="canonical" href="/a"><link rel="canonical" href="/b"></head><body></body></html>'
		);
		expect(meta.duplicates.canonical).toBe(2);
	});

	it('matches a canonical link whatever the rel casing', () => {
		const meta = parse('<html><head><link rel="CANONICAL" href="/a"></head><body></body></html>');
		expect(meta.canonical).toBe('https://acme.com/a');
	});

	it('reports one of each for an ordinary page', () => {
		const meta = parse(
			'<html><head><title>T</title><link rel="canonical" href="/x"></head><body></body></html>'
		);
		expect(meta.duplicates).toEqual({ title: 1, canonical: 1 });
	});
});

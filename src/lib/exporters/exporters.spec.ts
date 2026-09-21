import { describe, it, expect } from 'vitest';
import { toCsv, toJson } from './exporters';
import type { PageMeta } from '../scrapers/PageMeta';

function meta(over: Partial<PageMeta> = {}): PageMeta {
	return {
		pageUrl: 'https://acme.com/',
		title: 'Acme',
		canonical: 'https://acme.com/',
		icon: null,
		tags: [],
		duplicates: { title: 1, canonical: 1 },
		jsonLd: { entities: [], parseErrors: 0 } as unknown as PageMeta['jsonLd'],
		hreflang: [],
		robots: {
			robots: null,
			googlebot: null,
			header: null,
			noindex: false,
			nofollow: false,
			source: null
		},
		...over
	};
}

const tag = (key: string, value: string) =>
	({ key, value, source: 'name', category: 'seo' }) as PageMeta['tags'][number];

describe('toCsv formula injection (E18)', () => {
	it('neutralises a value that a spreadsheet would execute', () => {
		// Meta values are controlled by the audited site, and the export opens in Excel/Sheets.
		const csv = toCsv(meta({ tags: [tag('description', '=HYPERLINK("http://evil","click")')] }));
		expect(csv).toContain('\t=HYPERLINK');
		expect(csv).not.toMatch(/,=HYPERLINK/);
	});

	it('neutralises every dangerous prefix', () => {
		for (const prefix of ['=', '+', '-', '@']) {
			const csv = toCsv(meta({ tags: [tag('description', `${prefix}cmd`)] }));
			expect(csv, prefix).toContain(`\t${prefix}cmd`);
		}
	});

	it('leaves ordinary values alone', () => {
		const csv = toCsv(meta({ tags: [tag('description', 'A normal description')] }));
		expect(csv).toContain('description,A normal description');
		expect(csv).not.toContain('\t');
	});

	it('still quotes values containing commas and quotes', () => {
		const csv = toCsv(meta({ tags: [tag('description', 'one, two "three"')] }));
		expect(csv).toContain('"one, two ""three"""');
	});

	it('keeps the header row', () => {
		expect(toCsv(meta()).split('\n')[0]).toBe('key,value,source,category');
	});
});

describe('toJson', () => {
	it('emits parseable JSON with the title', () => {
		expect(JSON.parse(toJson(meta())).title).toBe('Acme');
	});
});

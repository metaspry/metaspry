import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCAN_SCHEMA_VERSION, bandFor as contractBandFor, scanIdFor } from './scan-contract';
import { bandFor } from '../audit/band';
import { normalizeScanUrl } from '../cloud/scan-identity';
import { toScanPayload } from '../cloud/sync';
import { getMetaTags } from '../scrapers/getMetaTags';
import { audit } from '../audit/rules';

// The app's fixture (app/functions/test/fixtures/scan-contract.json, vendored byte for byte and kept
// in step by `npm run contract:check`) run through the extension's own code paths.

const read = <T>(name: string): T => JSON.parse(readFileSync(resolve(__dirname, name), 'utf8')) as T;
const contract = read<{
  schemaVersion: number;
  bands: { score: number; rules: { severity: string; status: string }[]; band: string }[];
  scanIds: { url: string; id: string }[];
}>('scan-contract.json');
const keys = read<{ vectors: { input: string; key: string; id: string; rawId: string }[] }>('scan-keys.json');

describe('the extension matches the shared scan contract', () => {
  it('writes the contract schema version', () => {
    expect(SCAN_SCHEMA_VERSION).toBe(contract.schemaVersion);
    const meta = getMetaTags(new DOMParser().parseFromString('<html><head><title>T</title></head></html>', 'text/html').documentElement, 'https://a.com/');
    expect(toScanPayload(meta, audit(meta), 'https://a.com/').schemaVersion).toBe(contract.schemaVersion);
  });

  it.each(contract.bands)('score $score -> $band (band.ts and the contract)', (f) => {
    expect(bandFor(f.score, f.rules)).toBe(f.band);
    expect(contractBandFor(f.score, f.rules)).toBe(f.band);
  });

  it.each(contract.scanIds)('scanIdFor($url) = $id', (f) => {
    expect(scanIdFor(f.url)).toBe(f.id);
  });
});

describe('scan-key vectors (published for the app)', () => {
  it.each(keys.vectors)('$input files under $key', (v) => {
    expect(normalizeScanUrl(v.input)).toBe(v.key);
    expect(scanIdFor(v.key)).toBe(v.id);
    expect(scanIdFor(v.input)).toBe(v.rawId);
  });
});

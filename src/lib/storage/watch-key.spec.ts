import { describe, it, expect, vi, afterEach } from 'vitest';
import { watchKey } from './watch';

type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

function installChrome() {
  const listeners: Listener[] = [];
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      onChanged: { addListener: (l: Listener) => void listeners.push(l) },
    },
  };
  return {
    fire: (changes: Record<string, { newValue?: unknown }>, area = 'local') =>
      listeners.forEach((l) => l(changes, area)),
    count: () => listeners.length,
  };
}

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
  vi.restoreAllMocks();
});

describe('watchKey', () => {
  it('applies a change another surface made to the watched key', () => {
    const chrome = installChrome();
    const seen: unknown[] = [];
    watchKey('history', (raw) => void seen.push(raw));
    chrome.fire({ history: { newValue: [{ url: 'https://acme.com/' }] } });
    expect(seen).toEqual([[{ url: 'https://acme.com/' }]]);
  });

  it('ignores other keys', () => {
    const chrome = installChrome();
    const apply = vi.fn();
    watchKey('history', apply);
    chrome.fire({ settings: { newValue: {} } });
    expect(apply).not.toHaveBeenCalled();
  });

  it('ignores other storage areas', () => {
    const chrome = installChrome();
    const apply = vi.fn();
    watchKey('history', apply);
    chrome.fire({ history: { newValue: [] } }, 'sync');
    expect(apply).not.toHaveBeenCalled();
  });

  it('passes undefined through when the key is cleared', () => {
    const chrome = installChrome();
    const seen: unknown[] = [];
    watchKey('history', (raw) => void seen.push(raw));
    chrome.fire({ history: {} });
    expect(seen).toEqual([undefined]);
  });

  it('is a no-op outside the extension runtime', () => {
    expect(() => watchKey('history', () => {})).not.toThrow();
  });
});

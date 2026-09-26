import { describe, it, expect } from 'vitest';
import { bandFor, bandForVerdict, bandLabel, bandClasses, scoreLabel } from './band';

describe('band helper', () => {
  it('splits at 80 and 50, inclusive at the top', () => {
    expect(bandFor(100)).toBe('good');
    expect(bandFor(80)).toBe('good');
    expect(bandFor(79)).toBe('warn');
    expect(bandFor(50)).toBe('warn');
    expect(bandFor(49)).toBe('fail');
    expect(bandFor(0)).toBe('fail');
  });

  it('uses the legend words and builds the accessible name', () => {
    expect(bandLabel('good')).toBe('healthy');
    expect(bandLabel('warn')).toBe('needs work');
    expect(bandLabel('fail')).toBe('failing');
    expect(scoreLabel(92)).toBe('Score 92 of 100, healthy');
    expect(scoreLabel(49.6)).toBe('Score 50 of 100, needs work');
    expect(scoreLabel(-3)).toBe('Score 0 of 100, failing');
  });

  it('returns one hue family per band for text, chip and stroke', () => {
    for (const [band, hue] of [
      ['good', 'emerald'],
      ['warn', 'amber'],
      ['fail', 'rose'],
    ] as const) {
      const c = bandClasses(band);
      expect(c.text).toContain(hue);
      expect(c.chip).toContain(hue);
      expect(c.stroke).toContain(hue);
      expect(c.fill).toContain(hue);
      expect(c.ink).toContain(hue);
    }
  });

  it('uses -600 / -700 in light mode (never -500, which fails 3:1 on the light Screen)', () => {
    for (const band of ['good', 'warn', 'fail'] as const) {
      const c = bandClasses(band);
      for (const cls of [c.text, c.stroke, c.fill]) {
        const light = cls.split(' ').filter((t) => !t.startsWith('dark:'));
        expect(light.every((t) => /-(600|700)$/.test(t))).toBe(true);
      }
    }
  });

  it('keeps small status text at -700 / -800 in light (4.5:1 on the light card)', () => {
    for (const band of ['good', 'warn', 'fail'] as const) {
      const light = bandClasses(band).ink.split(' ').filter((t) => !t.startsWith('dark:'));
      expect(light.every((t) => /-(700|800)$/.test(t))).toBe(true);
    }
  });

  it('maps a rule / check verdict to its band', () => {
    expect(bandForVerdict('pass')).toBe('good');
    expect(bandForVerdict('warn')).toBe('warn');
    expect(bandForVerdict('fail')).toBe('fail');
  });
});

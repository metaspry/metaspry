import { describe, it, expect } from 'vitest';
import { initialsFor } from './initials';

describe('initialsFor', () => {
  it('takes the first letter of the first two dotted parts', () => {
    expect(initialsFor('paul.lukic94@gmail.com')).toBe('PL');
  });

  it('uses one letter for a single-word local part', () => {
    expect(initialsFor('paul@metaspry.com')).toBe('P');
  });

  it('splits on underscores, hyphens and plus signs too', () => {
    expect(initialsFor('jane_doe@x.io')).toBe('JD');
    expect(initialsFor('ann-marie+work@x.io')).toBe('AM');
  });

  it('keeps digit parts, drops symbol-only parts, upper-cases', () => {
    expect(initialsFor('42.abc@x.io')).toBe('4A');
    expect(initialsFor('..@x.io')).toBe('M');
  });

  it('keeps non-ASCII letters', () => {
    expect(initialsFor('élodie.martin@x.io')).toBe('ÉM');
  });

  it('falls back to M when there is no email', () => {
    expect(initialsFor('')).toBe('M');
    expect(initialsFor(null)).toBe('M');
    expect(initialsFor(undefined)).toBe('M');
  });
});

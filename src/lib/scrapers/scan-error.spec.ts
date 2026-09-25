import { describe, it, expect } from 'vitest';
import { describeScanError, BLOCKED_PAGE_REASON } from './scan-error';

describe('describeScanError', () => {
  it('maps a missing message channel to the blocked-page reason', () => {
    const r = describeScanError(new TypeError("Cannot read properties of undefined (reading 'sendMessage')"));
    expect(r.reason).toBe(BLOCKED_PAGE_REASON);
    expect(r.detail).toContain('sendMessage');
  });

  it('maps a dead receiver the same way', () => {
    expect(describeScanError(new Error('Could not establish connection. Receiving end does not exist.')).reason).toBe(
      BLOCKED_PAGE_REASON,
    );
    expect(describeScanError(new Error('No response from background script.')).reason).toBe(BLOCKED_PAGE_REASON);
  });

  it('names a permission problem', () => {
    expect(describeScanError(new Error('Cannot access contents of the page.')).reason).toContain("doesn't have permission");
  });

  it('names an unsupported URL', () => {
    expect(describeScanError(new Error('Invalid URL')).reason).toContain("isn't a web page");
  });

  it('keeps the raw text out of the reason and in the detail', () => {
    const r = describeScanError(new Error('Weird internal failure 42'));
    expect(r.reason).not.toContain('42');
    expect(r.detail).toBe('Weird internal failure 42');
  });

  it('has no detail when there is no message', () => {
    expect(describeScanError(undefined).detail).toBeNull();
    expect(describeScanError('').detail).toBeNull();
  });
});

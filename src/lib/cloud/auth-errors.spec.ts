import { describe, it, expect } from 'vitest';
import { signInErrorMessage, googleSignInErrorMessage } from './auth-errors';

const err = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });

describe('signInErrorMessage', () => {
  it('maps an unknown user to account creation', () => {
    expect(signInErrorMessage(err('auth/user-not-found'))).toBe('No account with that email - create one on the web app.');
  });

  it('maps a wrong password', () => {
    expect(signInErrorMessage(err('auth/wrong-password'))).toMatch(/^Wrong password/);
  });

  it('names both causes for the merged invalid-credential code', () => {
    const msg = signInErrorMessage(err('auth/invalid-credential'));
    expect(msg).toContain('Wrong email or password');
    expect(msg).toContain('Create one');
  });

  it('maps a network failure', () => {
    expect(signInErrorMessage(err('auth/network-request-failed'))).toMatch(/^Couldn't reach Metaspry/);
  });

  it('never leaks the raw code or message', () => {
    for (const c of ['auth/user-not-found', 'auth/invalid-credential', 'auth/internal-error', '']) {
      const msg = signInErrorMessage(err(c));
      expect(msg).not.toContain('auth/');
      expect(msg).not.toContain('Firebase');
    }
    expect(signInErrorMessage('boom')).toBe("Couldn't sign you in. Try again.");
  });
});

describe('googleSignInErrorMessage', () => {
  it('recognises a cancelled flow', () => {
    expect(googleSignInErrorMessage(new Error('The user did not approve access.'))).toBe('Google sign-in was cancelled.');
    expect(googleSignInErrorMessage(new Error('Sign-in was cancelled.'))).toBe('Google sign-in was cancelled.');
  });

  it('hides anything else behind a plain sentence', () => {
    expect(googleSignInErrorMessage(new Error('Authorization page could not be loaded.'))).not.toContain('Authorization page');
  });
});

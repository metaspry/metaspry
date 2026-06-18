/**
 * Cloud auth state for the extension. Same account as the web app. Email/password +
 * Google sign-in (chrome.identity launchWebAuthFlow -> Firebase credential).
 */
import { writable } from 'svelte/store';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { fbAuth } from './firebase';

export const cloudUser = writable<User | null>(null);
export const cloudReady = writable(false);

let started = false;
export function initCloudAuth(): void {
  if (started) return;
  started = true;
  onAuthStateChanged(fbAuth(), (u) => {
    cloudUser.set(u);
    cloudReady.set(true);
  });
}

export function cloudSignIn(email: string, password: string) {
  return signInWithEmailAndPassword(fbAuth(), email, password);
}

/**
 * Google sign-in for the extension. Uses chrome.identity.getAuthToken (Chrome Extension
 * OAuth client - client id + scopes declared in manifest "oauth2") to get a Google access
 * token, then exchanges it for a Firebase credential. No redirect URI needed; the client is
 * bound to the published extension id.
 */
export async function cloudSignInWithGoogle(): Promise<void> {
  const result = await chrome.identity.getAuthToken({ interactive: true });
  // Older typings return a string; newer return { token, grantedScopes }.
  const accessToken = typeof result === 'string' ? result : result?.token;
  if (!accessToken) throw new Error('No Google token returned.');
  await signInWithCredential(fbAuth(), GoogleAuthProvider.credential(null, accessToken));
}

export function cloudSignOut() {
  return fbSignOut(fbAuth());
}

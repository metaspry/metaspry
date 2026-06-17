/**
 * Cloud auth state for the extension (email/password). Same account as the web app.
 * Google sign-in needs an OAuth client id via chrome.identity, added later.
 */
import { writable } from 'svelte/store';
import {
  onAuthStateChanged,
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

export function cloudSignOut() {
  return fbSignOut(fbAuth());
}

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

// OAuth 2.0 *Web application* client (Google Cloud project "metaspry"). The chrome.identity
// redirect (https://<extension-id>.chromiumapp.org/) must be added to this client's
// Authorized redirect URIs. (A "Chrome Extension" client type does NOT work here - it forces a
// custom URI scheme, which Google rejects.)
const GOOGLE_CLIENT_ID =
  '540366408211-dgqe276vt9j1b9oin5i27orh30q0js4d.apps.googleusercontent.com';

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
 * Google sign-in for the extension. chrome.identity.launchWebAuthFlow opens Google's OIDC
 * flow to the https chromiumapp.org redirect, returns a Google ID token, which we exchange
 * for a Firebase credential. Works on unpacked + published as long as the running extension's
 * https://<id>.chromiumapp.org/ redirect is registered on the Web application OAuth client.
 */
export async function cloudSignInWithGoogle(): Promise<void> {
  const redirectUri = chrome.identity.getRedirectURL(); // https://<ext-id>.chromiumapp.org/
  const nonce = crypto.randomUUID();
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      response_type: 'id_token',
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      nonce,
      prompt: 'select_account',
    }).toString();

  const redirected = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  if (!redirected) throw new Error('Sign-in was cancelled.');
  const frag = redirected.split('#')[1] ?? '';
  const idToken = new URLSearchParams(frag).get('id_token');
  if (!idToken) throw new Error('No id_token returned from Google.');
  await signInWithCredential(fbAuth(), GoogleAuthProvider.credential(idToken));
}

export function cloudSignOut() {
  return fbSignOut(fbAuth());
}

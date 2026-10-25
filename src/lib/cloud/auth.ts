/**
 * Cloud auth state for the extension. Same account as the web app. Email/password +
 * Google sign-in (chrome.identity launchWebAuthFlow -> Firebase credential). Uses the
 * `firebase/auth/web-extension` entry (no popup/redirect/reCAPTCHA; see firebase.ts).
 *
 * Firebase loads lazily (UX review item 11, `sdk.ts`): at open only when a session may exist
 * (`session.ts`), otherwise when the user starts signing in, or when the other surface signs in.
 */
import { writable } from 'svelte/store';
import type { User } from './firebase';
import { authSdk } from './sdk';
import { maySignedIn, SESSION_HINT_KEY, writeSessionHint } from './session';
import { watchKey } from '../storage/watch';

// OAuth 2.0 *Web application* client (Google Cloud project "metaspry"). The chrome.identity
// redirect (https://<extension-id>.chromiumapp.org/) must be added to this client's
// Authorized redirect URIs. (A "Chrome Extension" client type does NOT work here - it forces a
// custom URI scheme, which Google rejects.)
const GOOGLE_CLIENT_ID =
  '540366408211-dgqe276vt9j1b9oin5i27orh30q0js4d.apps.googleusercontent.com';

export const cloudUser = writable<User | null>(null);
/** Auth state is known (signed in or out). Until then the account control shows a placeholder. */
export const cloudReady = writable(false);

let listening: Promise<void> | null = null;

/** Loads Firebase auth and follows its state. Idempotent. */
function startListening(): Promise<void> {
  if (!listening) {
    listening = authSdk().then(({ auth, onAuthStateChanged }) => {
      onAuthStateChanged(auth, (u) => {
        cloudUser.set(u);
        cloudReady.set(true);
        writeSessionHint(!!u);
      });
    });
    // The SDK failed to load: show signed out (the next sign-in attempt retries the load).
    listening.catch(() => {
      listening = null;
      cloudReady.set(true);
    });
  }
  return listening;
}

let started = false;
export function initCloudAuth(): void {
  if (started) return;
  started = true;
  void maySignedIn().then((maybe) => {
    if (maybe) void startListening();
    else cloudReady.set(true);
  });
  // The other surface signed in: follow it.
  watchKey(SESSION_HINT_KEY, (raw) => {
    if (raw === true) void startListening();
  });
}

export async function cloudSignIn(email: string, password: string) {
  await startListening();
  const { auth, signInWithEmailAndPassword } = await authSdk();
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Google sign-in for the extension. chrome.identity.launchWebAuthFlow opens Google's OIDC
 * flow to the https chromiumapp.org redirect, returns a Google ID token, which we exchange
 * for a Firebase credential. Works on unpacked + published as long as the running extension's
 * https://<id>.chromiumapp.org/ redirect is registered on the Web application OAuth client.
 */
export async function cloudSignInWithGoogle(): Promise<void> {
  // Started before the auth window opens, so the SDK loads while the user picks an account.
  const ready = startListening();
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
  await ready;
  const { auth, signInWithCredential, GoogleAuthProvider } = await authSdk();
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export async function cloudSignOut() {
  await startListening();
  const { auth, signOut } = await authSdk();
  return signOut(auth);
}

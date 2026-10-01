/**
 * Firebase client for the extension. The web config is public by design (it ships in
 * every web bundle); embedding it here is safe. Auth state persists in the popup's
 * IndexedDB. Used only to sync scans to the signed-in user's cloud history.
 *
 * Auth comes from `firebase/auth/web-extension`, never `firebase/auth`: the default entry bundles
 * the gapi and reCAPTCHA loader URLs, which Chrome Web Store review flags as remotely hosted code
 * (`scripts/check-remote-code.mjs` fails the build if they come back). Its `getAuth` persists the
 * session in IndexedDB, the same store the default entry used, so signed-in users stay signed in.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth/web-extension';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

// The web-extension entry's public .d.ts declares `Auth` and `User` without exporting them (Firebase
// 12.15 rollup), so the types are derived from its functions instead of importing `firebase/auth`.
export type Auth = ReturnType<typeof getAuth>;
export type User = NonNullable<Auth['currentUser']>;

const config = {
  apiKey: 'AIzaSyA8oyecuKrJ66Ow1jpvH2_IFYIXTUAtbTc',
  authDomain: 'metaspry.firebaseapp.com',
  projectId: 'metaspry',
  storageBucket: 'metaspry.firebasestorage.app',
  messagingSenderId: '540366408211',
  appId: '1:540366408211:web:ae9db418bb43a6af6dcde6',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function fbApp(): FirebaseApp {
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function fbAuth(): Auth {
  return getAuth(fbApp());
}

export function fbDb(): Firestore {
  // ignoreUndefinedProperties so optional meta fields can be omitted without throwing.
  if (!db) db = initializeFirestore(fbApp(), { ignoreUndefinedProperties: true });
  return db;
}

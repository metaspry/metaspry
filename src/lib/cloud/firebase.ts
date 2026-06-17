/**
 * Firebase client for the extension. The web config is public by design (it ships in
 * every web bundle); embedding it here is safe. Auth state persists in the popup's
 * IndexedDB. Used only to sync scans to the signed-in user's cloud history.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

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

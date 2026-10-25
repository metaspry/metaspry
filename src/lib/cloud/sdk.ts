/**
 * The Firebase SDK, loaded on first use (UX review item 11). Every cloud module imported Firebase
 * statically, so a signed-out user parsed ~1 MB of SDK on every open of the side panel or popup.
 * Nothing in the app may import `./firebase` or `firebase/*` statically any more (type-only imports
 * are fine): `sdk.spec.ts` checks the source and the e2e suite checks what a signed-out open loads.
 */
export async function firestoreSdk() {
  const [{ fbDb }, fs] = await Promise.all([import('./firebase'), import('firebase/firestore')]);
  return { db: fbDb(), ...fs };
}

export async function authSdk() {
  const [{ fbAuth }, a] = await Promise.all([import('./firebase'), import('firebase/auth/web-extension')]);
  return { auth: fbAuth(), ...a };
}

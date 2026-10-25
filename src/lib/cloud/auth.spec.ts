import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// The lazy-auth flow (UX review item 11): Firebase loads only when a session may exist, on sign-in,
// or when the other surface signs in. `sdk.ts`, `session.ts` and `watchKey` are the boundaries.

const authSdk = vi.fn();
const maySignedIn = vi.fn();
const writeSessionHint = vi.fn();
let watched: ((raw: unknown) => void) | null = null;

vi.mock('./sdk', () => ({ authSdk: () => authSdk(), firestoreSdk: vi.fn() }));
vi.mock('./session', () => ({
  SESSION_HINT_KEY: 'cloudSession',
  maySignedIn: () => maySignedIn(),
  writeSessionHint: (v: boolean) => writeSessionHint(v),
}));
vi.mock('../storage/watch', () => ({
  watchKey: (_key: string, apply: (raw: unknown) => void) => {
    watched = apply;
  },
}));

type AuthCb = (u: { uid: string; email: string } | null) => void;
function fakeSdk() {
  let cb: AuthCb = () => {};
  const sdk = {
    auth: {},
    onAuthStateChanged: vi.fn((_a: unknown, next: AuthCb) => {
      cb = next;
    }),
    signInWithEmailAndPassword: vi.fn(async () => {
      cb({ uid: 'u1', email: 'a@b.c' });
    }),
    signOut: vi.fn(async () => cb(null)),
  };
  return { sdk, emit: (u: { uid: string; email: string } | null) => cb(u) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.resetModules();
  authSdk.mockReset();
  maySignedIn.mockReset();
  writeSessionHint.mockReset();
  watched = null;
});

describe('initCloudAuth', () => {
  it('no session: Firebase is not loaded, the control is ready and signed out', async () => {
    maySignedIn.mockResolvedValue(false);
    const { initCloudAuth, cloudReady, cloudUser } = await import('./auth');
    initCloudAuth();
    await flush();
    expect(authSdk).not.toHaveBeenCalled();
    expect(get(cloudReady)).toBe(true);
    expect(get(cloudUser)).toBeNull();
  });

  it('a possible session: Firebase loads and the user and hint follow its state', async () => {
    const { sdk, emit } = fakeSdk();
    authSdk.mockResolvedValue(sdk);
    maySignedIn.mockResolvedValue(true);
    const { initCloudAuth, cloudReady, cloudUser } = await import('./auth');
    initCloudAuth();
    await flush();
    expect(sdk.onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(get(cloudReady)).toBe(false);
    emit({ uid: 'u1', email: 'a@b.c' });
    expect(get(cloudUser)?.uid).toBe('u1');
    expect(get(cloudReady)).toBe(true);
    expect(writeSessionHint).toHaveBeenLastCalledWith(true);
    emit(null);
    expect(writeSessionHint).toHaveBeenLastCalledWith(false);
  });

  it('signing in loads Firebase on demand, once', async () => {
    const { sdk } = fakeSdk();
    authSdk.mockResolvedValue(sdk);
    maySignedIn.mockResolvedValue(false);
    const { initCloudAuth, cloudSignIn, cloudUser } = await import('./auth');
    initCloudAuth();
    await flush();
    await cloudSignIn('a@b.c', 'pw');
    expect(sdk.onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledWith(sdk.auth, 'a@b.c', 'pw');
    expect(get(cloudUser)?.uid).toBe('u1');
  });

  it('the other surface signing in (cloudSession: true) starts auth here', async () => {
    const { sdk } = fakeSdk();
    authSdk.mockResolvedValue(sdk);
    maySignedIn.mockResolvedValue(false);
    const { initCloudAuth } = await import('./auth');
    initCloudAuth();
    await flush();
    expect(authSdk).not.toHaveBeenCalled();
    watched?.(true);
    await flush();
    expect(sdk.onAuthStateChanged).toHaveBeenCalledTimes(1);
  });

  it('an SDK that fails to load leaves the control usable (signed out) and retries on sign-in', async () => {
    const { sdk } = fakeSdk();
    authSdk.mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValue(sdk);
    maySignedIn.mockResolvedValue(true);
    const { initCloudAuth, cloudReady, cloudSignIn } = await import('./auth');
    initCloudAuth();
    await flush();
    expect(get(cloudReady)).toBe(true);
    await cloudSignIn('a@b.c', 'pw');
    expect(sdk.onAuthStateChanged).toHaveBeenCalledTimes(1);
  });
});

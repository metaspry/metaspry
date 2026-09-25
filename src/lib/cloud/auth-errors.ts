/**
 * Plain-language sign-in failures for the account popover. Never shows a raw Firebase code or
 * exception text. Since 2023 Firebase answers `auth/invalid-credential` for both an unknown email
 * and a wrong password (email-enumeration protection), so that code names both causes and points
 * at account creation; the older split codes are mapped too for projects that still return them.
 */
function codeOf(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
}

export function signInErrorMessage(err: unknown): string {
  switch (codeOf(err)) {
    case 'auth/user-not-found':
      return 'No account with that email - create one on the web app.';
    case 'auth/wrong-password':
      return 'Wrong password. Reset it on the web app if you forgot it.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Wrong email or password. No account yet? Create one on the web app.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/user-disabled':
      return 'This account is disabled. Contact hello@metaspry.com.';
    case 'auth/network-request-failed':
      return "Couldn't reach Metaspry. Check your connection and try again.";
    default:
      return "Couldn't sign you in. Try again.";
  }
}

/** Google sign-in runs through chrome.identity, whose errors are English sentences, not codes. */
export function googleSignInErrorMessage(err: unknown): string {
  if (codeOf(err) === 'auth/network-request-failed') return signInErrorMessage(err);
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  if (message.includes('cancel') || message.includes('did not approve') || message.includes('closed')) {
    return 'Google sign-in was cancelled.';
  }
  return "Couldn't sign in with Google. Try again, or use your email and password.";
}

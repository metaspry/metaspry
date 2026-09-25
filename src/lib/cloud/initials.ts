/**
 * Initials for the header's account control, from the sign-in email. "paul.lukic94@x" -> "PL",
 * "paul@x" -> "P". Falls back to "M" (Metaspry) when there is nothing usable, so the circle is
 * never empty.
 */
export function initialsFor(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0] ?? '';
  const parts = local
    .split(/[._\-+]+/)
    .map((p) => p.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return letters || 'M';
}

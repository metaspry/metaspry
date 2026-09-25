/**
 * Initials for the header's account control, from the sign-in email. "paul.lukic94@x" -> "PL",
 * "paul@x" -> "P". Falls back to "M" (Metaspry) when there is nothing usable, so the circle is
 * never empty.
 */
export function initialsFor(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0] ?? '';
  // Keep letters and digits from any script (\p{L}\p{N}), so "élodie" gives "E", not "L".
  const parts = local
    .split(/[._\-+]+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return letters || 'M';
}

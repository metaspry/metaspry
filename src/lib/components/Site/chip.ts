/**
 * The status chip on each Site card (UX review 2026-10-25, Medium 17). A timeout or a server error
 * used to show the red "Missing" chip, and a robots.txt that blocks every crawler showed a green
 * "Found". The chip now says what was actually learned.
 */
import type { RobotsInfo } from '../../scrapers/SiteFiles';

export type SiteChip = { label: string; tone: 'good' | 'warn' | 'fail' | 'neutral' };

/**
 * A missing file is a real answer (404 / 410, or an HTML fallback page at that path); anything
 * else that failed (timeout, network, 5xx, a refused redirect) means we could not tell.
 */
export function couldNotCheck(error: string | undefined): boolean {
  if (!error) return false;
  if (/^HTTP (404|410)$/.test(error)) return false;
  if (/returned HTML/i.test(error)) return false;
  return true;
}

/** `User-agent: *` disallows `/` without allowing it back: the whole site is closed to crawlers. */
export function blocksEveryone(robots: Pick<RobotsInfo, 'groups'>): boolean {
  const star = robots.groups.find((g) => g.userAgents.includes('*'));
  return !!star && star.disallow.includes('/') && !star.allow.includes('/');
}

export function robotsChip(robots: Pick<RobotsInfo, 'present' | 'error' | 'groups'>): SiteChip {
  if (robots.present) return blocksEveryone(robots) ? { label: 'Blocks all', tone: 'warn' } : { label: 'Found', tone: 'good' };
  return couldNotCheck(robots.error) ? { label: "Couldn't check", tone: 'neutral' } : { label: 'Missing', tone: 'fail' };
}

export function fileChip(file: { present: boolean; error?: string }, absent: SiteChip): SiteChip {
  if (file.present) return { label: 'Found', tone: 'good' };
  return couldNotCheck(file.error) ? { label: "Couldn't check", tone: 'neutral' } : absent;
}

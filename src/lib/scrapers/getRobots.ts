export interface RobotsInfo {
  robots: string | null;
  googlebot: string | null;
  noindex: boolean;
  nofollow: boolean;
}

function parseDirectives(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function getRobots(html: HTMLElement): RobotsInfo {
  const robotsEl = html.querySelector('meta[name="robots"]');
  const googlebotEl = html.querySelector('meta[name="googlebot"]');
  const robots = robotsEl?.getAttribute('content')?.trim() ?? null;
  const googlebot = googlebotEl?.getAttribute('content')?.trim() ?? null;

  const directives = new Set([
    ...parseDirectives(robots),
    ...parseDirectives(googlebot),
  ]);

  return {
    robots,
    googlebot,
    noindex: directives.has('noindex') || directives.has('none'),
    nofollow: directives.has('nofollow') || directives.has('none'),
  };
}

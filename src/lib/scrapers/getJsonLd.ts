export interface JsonLdEntity {
  type: string;
  data: Record<string, unknown>;
}

export interface JsonLdResult {
  entities: JsonLdEntity[];
  parseErrors: number;
}

function typeOf(node: Record<string, unknown>): string {
  const t = node['@type'];
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) return t.map(String).join(', ');
  return 'Unknown';
}

function flattenGraph(parsed: unknown, into: JsonLdEntity[]): void {
  if (!parsed) return;
  if (Array.isArray(parsed)) {
    for (const item of parsed) flattenGraph(item, into);
    return;
  }
  if (typeof parsed !== 'object') return;
  const node = parsed as Record<string, unknown>;
  const graph = node['@graph'];
  if (Array.isArray(graph)) {
    for (const item of graph) flattenGraph(item, into);
    return;
  }
  if ('@type' in node) {
    into.push({ type: typeOf(node), data: node });
  }
}

export function getJsonLd(html: HTMLElement): JsonLdResult {
  const scripts = html.querySelectorAll('script[type="application/ld+json"]');
  const entities: JsonLdEntity[] = [];
  let parseErrors = 0;
  scripts.forEach((script) => {
    const raw = script.textContent?.trim();
    if (!raw) return;
    try {
      flattenGraph(JSON.parse(raw), entities);
    } catch {
      parseErrors++;
    }
  });
  return { entities, parseErrors };
}

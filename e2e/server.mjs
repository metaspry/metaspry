// Static server for the e2e fixture site (e2e/site). Playwright starts it through `webServer`;
// the extension scans these pages and fetches their robots.txt / sitemap.xml / llms.txt.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./site/', import.meta.url));
// Fixed: the fixture pages and robots.txt / sitemap.xml / llms.txt hardcode it.
const PORT = 4319;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
};
// Response headers a fixture needs beyond the content type.
const HEADERS = {
  '/noindex-header.html': { 'x-robots-tag': 'noindex' },
};
// Paths that answer with a redirect (Compare's "this URL redirected" note).
const REDIRECTS = {
  '/members-only.html': '/login.html',
};

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (REDIRECTS[path]) {
    res.writeHead(302, { location: REDIRECTS[path] }).end();
    return;
  }
  const file = normalize(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res
      .writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', ...(HEADERS[path] ?? {}) })
      .end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`e2e fixture site on http://127.0.0.1:${PORT}`));

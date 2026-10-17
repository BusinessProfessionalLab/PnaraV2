// Tiny static server with clean URLs, for side-by-side checks of the builds.
// Resolves /x to x, x.html or x/index.html (so slugs with dots work), and
// answers anything else with 404.html and a 404 status, like the hosts do.
// usage: node tools/serve.mjs <dir> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
const [dir, port] = [resolve(process.argv[2]), Number(process.argv[3])];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.yml': 'text/yaml', '.ico': 'image/x-icon' };
const isFile = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '');
  const base = join(dir, path);
  if (!base.startsWith(dir)) { res.writeHead(403).end(); return; }
  for (const f of [base, base + '.html', join(base, 'index.html')]) {
    if (await isFile(f)) { res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); return; }
  }
  res.writeHead(404, { 'content-type': TYPES['.html'] });
  res.end(await readFile(join(dir, '404.html')));
}).listen(port, () => console.log(`${dir} on http://localhost:${port}`));

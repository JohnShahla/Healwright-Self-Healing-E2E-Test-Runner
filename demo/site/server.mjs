// Minimal static server for the demo. Serves demo/site/<SITE_VERSION>/index.html
// for every path. Switch markup versions by restarting with a different
// SITE_VERSION env var - that's how the demo "ships a new build" between runs.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const version = process.env.SITE_VERSION || 'v1';
const port = Number(process.env.PORT || 5050);
const html = readFileSync(join(here, version, 'index.html'), 'utf8');

createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(port, () => {
  console.error(`[demo-site] serving ${version} on http://localhost:${port}`);
});

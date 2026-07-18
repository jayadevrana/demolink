// A tiny static file server so you can try demolink with no app of your own.
//   node examples/serve.js          # serves ./examples on http://localhost:3000
//   PORT=8080 node examples/serve.js
// Then, in another terminal:  demolink 3000
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  // Resolve the request path under ROOT, defaulting to index.html.
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  if (rel.endsWith('/') || rel === '') rel += 'index.html';
  const file = join(ROOT, rel);

  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} on http://localhost:${PORT}`);
  console.log(`Now run:  demolink ${PORT}`);
});

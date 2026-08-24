/** Static server for the test fixtures. Used to exercise the scanner offline. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('./fixtures/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (p === '/' ) p = '/index.html';
  if (!extname(p)) p += '.html';
  try {
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>404</title><p>Not found');
  }
});
server.listen(8099, '127.0.0.1', () => console.log('fixtures on http://127.0.0.1:8099'));

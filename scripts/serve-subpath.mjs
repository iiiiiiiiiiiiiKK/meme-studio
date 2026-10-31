import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

/**
 * Serves the production build under `/meme-studio/` so the exact GitHub Pages
 * project-site layout (sub-path base) can be verified locally.
 */
const ROOT = join(process.cwd(), 'dist');
const PORT = 4290;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.bin': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  let url = (req.url ?? '/').split('?')[0];
  if (!url.startsWith('/meme-studio/')) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  url = url.slice('/meme-studio'.length);
  if (url === '/' || url === '') url = '/index.html';
  const file = join(ROOT, decodeURIComponent(url));
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving dist under /meme-studio/ on http://127.0.0.1:${PORT}/meme-studio/`);
});

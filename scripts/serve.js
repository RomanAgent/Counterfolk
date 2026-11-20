import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createModelRoutes } from '../server/model-routes.js';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const port = Number(process.env.COUNTERFOLK_PORT || '4177');

const handleModelRoute = createModelRoutes();

const server = http.createServer(async (request, response) => {
  try {
    if (await handleModelRoute(request, response)) return;
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, path === '/' ? 'index.html' : `.${path}`);
    if (!file.startsWith(root + sep) || !Object.hasOwn(mime, extname(file))
      || (file !== resolve(root, 'index.html')
        && !['src', 'assets', 'vendor'].some((dir) => file.startsWith(resolve(root, dir) + sep)))) {
      response.writeHead(404).end();
      return;
    }
    if (!(await stat(file)).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(file)],
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Counterfolk http://127.0.0.1:${port}`));

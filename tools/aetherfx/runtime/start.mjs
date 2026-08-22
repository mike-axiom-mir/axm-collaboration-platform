import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 4173);
const HOST = '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};
const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...securityHeaders, ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let requested;
  try {
    requested = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    send(res, 400, 'Malformed URL');
    return;
  }
  if (requested.includes('\0')) {
    send(res, 400, 'Malformed URL');
    return;
  }

  const rel = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const target = path.resolve(ROOT, rel);
  const relative = path.relative(ROOT, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.realpath(target, (realPathError, realTarget) => {
    if (realPathError) {
      send(res, 404, 'Not found');
      return;
    }
    const realRelative = path.relative(ROOT, realTarget);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      send(res, 403, 'Forbidden');
      return;
    }
    fs.stat(realTarget, (statError, stat) => {
      if (statError || !stat.isFile()) {
        send(res, 404, 'Not found');
        return;
      }
      fs.readFile(realTarget, (readError, data) => {
        if (readError) {
          send(res, 404, 'Not found');
          return;
        }
        res.writeHead(200, {
          ...securityHeaders,
          'Content-Type': mime[path.extname(realTarget)] || 'application/octet-stream',
          'Content-Length': data.length
        });
        res.end(req.method === 'HEAD' ? undefined : data);
      });
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`AXM AetherFX Visual Effect Fabric: http://${HOST}:${PORT}`);
  console.log('Press Ctrl+C to stop. The local server rejects traversal and external runtime connections.');
});

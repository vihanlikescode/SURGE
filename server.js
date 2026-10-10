'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = __dirname;
const PORT = Number(process.env.SURGE_PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function createServer() {
  return http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (pathname === '/') pathname = '/index.html';
    const filename = path.resolve(ROOT, `.${pathname}`);
    if (filename !== ROOT && !filename.startsWith(`${ROOT}${path.sep}`)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(filename, (error, content) => {
      if (error) {
        res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filename)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      res.end(content);
    });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, '127.0.0.1', () => {
    const address = `http://127.0.0.1:${PORT}`;
    console.log(`Surge is running at ${address}`);
    console.log('Keep this window open while using Surge. Press Ctrl+C to stop.');
    const platform = process.platform;
    if (platform === 'win32')
      spawn('cmd', ['/c', 'start', '', address], { detached: true, stdio: 'ignore' }).unref();
    else if (platform === 'darwin')
      spawn('open', [address], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [address], { detached: true, stdio: 'ignore' }).unref();
  });
}

module.exports = { createServer };

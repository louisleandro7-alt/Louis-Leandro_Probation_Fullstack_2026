// server/server.js
// Entry point. A single Node process serves the REST API (/api/*) and the
// static frontend (/public) — no separate frontend build/dev server needed.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { Router } = require('./utils/router');
const { fail } = require('./utils/http');
const { getAuthenticatedAdmin } = require('./auth');

const authRoutes = require('./routes/auth.routes');
const eventsRoutes = require('./routes/events.routes');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const router = new Router();
authRoutes.register(router);
eventsRoutes.register(router);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Static routes that require a valid admin session before the file is served.
// (Client-side JS also guards against a briefly-cached page, but this is the
// real check: an unauthenticated request never receives the dashboard HTML.)
const PROTECTED_STATIC_PATHS = new Set(['/admin/dashboard.html', '/admin/dashboard']);

function resolveStaticPath(pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin/login.html';
  if (pathname === '/admin/dashboard') pathname = '/admin/dashboard.html';
  if (pathname === '/event') pathname = '/event.html';

  const safeSuffix = path
    .normalize(pathname)
    .replace(/^(\.\.[/\\])+/, '');
  return path.join(PUBLIC_DIR, safeSuffix);
}

function serveStatic(req, res, pathname) {
  if (PROTECTED_STATIC_PATHS.has(pathname)) {
    const admin = getAuthenticatedAdmin(req);
    if (!admin) {
      res.writeHead(302, { Location: '/admin/login.html' });
      return res.end();
    }
  }

  const filePath = resolveStaticPath(pathname);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const notFoundPath = path.join(PUBLIC_DIR, '404.html');
      fs.readFile(notFoundPath, (err2, notFoundData) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(notFoundData);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://internal').pathname);
  } catch {
    pathname = req.url.split('?')[0];
  }

  // Basic security/no-cache headers for API responses; static assets are fine to cache lightly.
  if (pathname.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');

    const matched = router.match(req.method, pathname);
    if (matched) {
      try {
        await matched.handler(req, res, matched.params);
      } catch (err) {
        console.error('Unhandled route error:', err);
        if (!res.headersSent) fail(res, 500, 'Internal server error.');
      }
      return;
    }

    if (router.pathExists(pathname)) {
      return fail(res, 405, `Method ${req.method} not allowed on ${pathname}.`);
    }
    return fail(res, 404, `No API route for ${req.method} ${pathname}.`);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method Not Allowed');
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Event management app listening on http://localhost:${PORT}`);
});

module.exports = { server };

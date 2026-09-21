// server/utils/router.js
// A tiny, dependency-free router (path-to-regex style) so the project doesn't
// need Express just to match routes like GET /api/events/:id.
'use strict';

class Router {
  constructor() {
    this.routes = []; // { method, pattern, keys, handler }
  }

  _register(method, path, handler) {
    const keys = [];
    const regexStr = path
      .split('/')
      .map((segment) => {
        if (segment.startsWith(':')) {
          keys.push(segment.slice(1));
          return '([^/]+)';
        }
        return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    const pattern = new RegExp(`^${regexStr}/?$`);
    this.routes.push({ method, pattern, keys, handler });
  }

  get(path, handler) {
    this._register('GET', path, handler);
  }
  post(path, handler) {
    this._register('POST', path, handler);
  }
  put(path, handler) {
    this._register('PUT', path, handler);
  }
  delete(path, handler) {
    this._register('DELETE', path, handler);
  }

  // Returns { handler, params } or null if no route matches.
  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.pattern.exec(pathname);
      if (!m) continue;
      const params = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(m[i + 1]);
      });
      return { handler: route.handler, params };
    }
    return null;
  }

  // Whether ANY method matches this path (used to distinguish 404 vs 405).
  pathExists(pathname) {
    return this.routes.some((route) => route.pattern.test(pathname));
  }
}

module.exports = { Router };

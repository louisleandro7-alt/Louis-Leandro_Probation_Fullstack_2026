// server/routes/auth.routes.js
'use strict';

const { db } = require('../db');
const {
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  getAuthenticatedAdmin,
} = require('../auth');
const { ok, fail, parseJsonBody } = require('../utils/http');

function register(router) {
  // POST /api/auth/login
  router.post('/api/auth/login', async (req, res) => {
    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      return fail(res, err.statusCode || 400, err.message);
    }

    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      return fail(res, 400, 'Username and password are required.', {
        ...(username ? {} : { username: 'Username is required.' }),
        ...(password ? {} : { password: 'Password is required.' }),
      });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      // Same message for both cases so we don't leak which part was wrong.
      return fail(res, 401, 'Invalid username or password.');
    }

    const token = signToken({ sub: admin.id, username: admin.username });
    setAuthCookie(res, token);
    ok(res, { admin: { id: admin.id, username: admin.username } });
  });

  // POST /api/auth/logout
  router.post('/api/auth/logout', async (req, res) => {
    clearAuthCookie(res);
    ok(res, { loggedOut: true });
  });

  // GET /api/auth/me
  router.get('/api/auth/me', async (req, res) => {
    const payload = getAuthenticatedAdmin(req);
    if (!payload) return fail(res, 401, 'Not authenticated.');
    ok(res, { admin: { id: payload.sub, username: payload.username } });
  });
}

module.exports = { register };

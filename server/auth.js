// server/auth.js
// Self-contained auth primitives built on Node's `crypto` module:
//  - password hashing with scrypt (salted, timing-safe compare)
//  - a minimal HMAC-SHA256 JWT implementation (header.payload.signature)
// No third-party dependency (bcrypt/jsonwebtoken) is required to run this project.
'use strict';

const crypto = require('node:crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS || 2 * 60 * 60); // 2h

// ---------- Password hashing ----------

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(plainPassword, storedHash) {
  const [salt, key] = String(storedHash).split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(plainPassword, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  if (derived.length !== keyBuffer.length) return false;
  return crypto.timingSafeEqual(derived, keyBuffer);
}

// ---------- Minimal JWT (HS256) ----------

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64');
}

function signToken(payload, ttlSeconds = TOKEN_TTL_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + ttlSeconds };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const encodedSignature = base64url(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actualSig = base64urlDecode(encodedSignature);

  if (
    expectedSig.length !== actualSig.length ||
    !crypto.timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload.exp !== 'number' || Math.floor(Date.now() / 1000) >= payload.exp) {
    return null; // expired
  }

  return payload;
}

// ---------- Cookie helpers ----------

const COOKIE_NAME = 'auth_token';

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

function setAuthCookie(res, token) {
  const maxAge = TOKEN_TTL_SECONDS;
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

// Reads either the auth cookie or an Authorization: Bearer header.
function getTokenFromRequest(req) {
  const cookies = parseCookies(req);
  if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

// Express-less "middleware": returns the decoded payload or null.
function getAuthenticatedAdmin(req) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  parseCookies,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest,
  getAuthenticatedAdmin,
  COOKIE_NAME,
};

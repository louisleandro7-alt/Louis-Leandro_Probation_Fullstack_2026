// server/utils/http.js
// Small helpers for consistent JSON responses and safe request body parsing.
'use strict';

const MAX_BODY_BYTES = 1024 * 1024; // 1MB safety cap

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function ok(res, data, statusCode = 200) {
  sendJson(res, statusCode, { success: true, data });
}

function fail(res, statusCode, message, fieldErrors) {
  sendJson(res, statusCode, {
    success: false,
    error: { message, ...(fieldErrors ? { fields: fieldErrors } : {}) },
  });
}

// Parses a JSON request body with a size cap. Resolves to {} for empty bodies.
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let received = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }));
      }
    });

    req.on('error', reject);
  });
}

module.exports = { ok, fail, sendJson, parseJsonBody };

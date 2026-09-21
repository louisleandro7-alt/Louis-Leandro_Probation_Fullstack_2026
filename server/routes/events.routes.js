// server/routes/events.routes.js
'use strict';

const { db } = require('../db');
const { getAuthenticatedAdmin } = require('../auth');
const { ok, fail, parseJsonBody } = require('../utils/http');
const { validateEventPayload, VALID_STATUSES } = require('../validators/event.validator');

function requireAdmin(req, res) {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    fail(res, 401, 'Authentication required.');
    return null;
  }
  return admin;
}

function register(router) {
  // GET /api/events?status=&search=&page=&limit=
  router.get('/api/events', async (req, res) => {
    const url = new URL(req.url, 'http://internal');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get('limit') || '9', 10) || 9)
    );
    const offset = (page - 1) * limit;

    const clauses = [];
    const params = [];

    if (status && status !== 'all') {
      if (!VALID_STATUSES.includes(status)) {
        return fail(res, 400, `Invalid status filter. Use one of: ${VALID_STATUSES.join(', ')}.`);
      }
      clauses.push('status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      clauses.push('(title LIKE ? OR location LIKE ?)');
      const like = `%${search.trim()}%`;
      params.push(like, like);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM events ${where}`)
      .get(...params).c;

    const rows = db
      .prepare(
        `SELECT id, title, description, event_date, location, status, image_url, created_at, updated_at
         FROM events ${where}
         ORDER BY event_date ASC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    ok(res, {
      events: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  });

  // GET /api/events/:id
  router.get('/api/events/:id', async (req, res, params) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return fail(res, 400, 'Invalid event id.');
    }
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!event) return fail(res, 404, 'Event not found.');
    ok(res, { event });
  });

  // POST /api/events  (admin only)
  router.post('/api/events', async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      return fail(res, err.statusCode || 400, err.message);
    }

    const { valid, errors, clean } = validateEventPayload(body, { partial: false });
    if (!valid) return fail(res, 400, 'Validation failed.', errors);

    try {
      const result = db
        .prepare(
          `INSERT INTO events (title, description, event_date, location, status, image_url, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          clean.title,
          clean.description,
          clean.event_date,
          clean.location,
          clean.status,
          clean.image_url ?? null,
          admin.sub
        );
      const event = db
        .prepare('SELECT * FROM events WHERE id = ?')
        .get(result.lastInsertRowid);
      ok(res, { event }, 201);
    } catch (err) {
      fail(res, 500, 'Failed to create event.');
    }
  });

  // PUT /api/events/:id  (admin only)
  router.put('/api/events/:id', async (req, res, params) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return fail(res, 400, 'Invalid event id.');
    }

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!existing) return fail(res, 404, 'Event not found.');

    let body;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      return fail(res, err.statusCode || 400, err.message);
    }

    const { valid, errors, clean } = validateEventPayload(body, { partial: true });
    if (!valid) return fail(res, 400, 'Validation failed.', errors);
    if (Object.keys(clean).length === 0) {
      return fail(res, 400, 'No valid fields provided to update.');
    }

    const fields = Object.keys(clean);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => clean[f]);

    db.prepare(
      `UPDATE events SET ${setClause}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values, id);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    ok(res, { event });
  });

  // DELETE /api/events/:id  (admin only)
  router.delete('/api/events/:id', async (req, res, params) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return fail(res, 400, 'Invalid event id.');
    }

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!existing) return fail(res, 404, 'Event not found.');

    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    ok(res, { deleted: true, id });
  });
}

module.exports = { register };

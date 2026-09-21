// server/db.js
// Central database module. Uses Node's built-in `node:sqlite` driver so the
// project runs with zero third-party dependencies (just `node server/server.js`).
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      event_date TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
      image_url TEXT,
      created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);`);
}

function seed() {
  const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (adminCount === 0) {
    const username = process.env.SEED_ADMIN_USERNAME || 'admin';
    const password = process.env.SEED_ADMIN_PASSWORD || 'admin12345';
    const password_hash = hashPassword(password);
    db.prepare(
      'INSERT INTO admins (username, password_hash) VALUES (?, ?)'
    ).run(username, password_hash);
    console.log(`[seed] Created default admin "${username}" (see README for password).`);
  }

  const eventCount = db.prepare('SELECT COUNT(*) AS c FROM events').get().c;
  if (eventCount === 0) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const sample = [
      {
        title: 'IEEE ITB General Assembly',
        description:
          'Annual gathering for all IEEE ITB Student Branch members to review the past year and vote on the upcoming board.',
        event_date: new Date(now + 10 * day).toISOString(),
        location: 'Aula Barat ITB',
        status: 'upcoming',
        image_url: null,
      },
      {
        title: 'Intro to Embedded Systems Workshop',
        description:
          'Hands-on workshop covering microcontroller basics, GPIO, and a small sensor-reading project for beginners.',
        event_date: new Date(now + 3 * day).toISOString(),
        location: 'Labtek V, Room 301',
        status: 'upcoming',
        image_url: null,
      },
      {
        title: 'IEEE Xtreme Kickoff',
        description:
          'Kickoff session and team formation for this year\u2019s IEEE Xtreme 24-hour programming competition.',
        event_date: new Date(now - 5 * day).toISOString(),
        location: 'Online (Zoom)',
        status: 'completed',
        image_url: null,
      },
    ];
    const insert = db.prepare(
      `INSERT INTO events (title, description, event_date, location, status, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const e of sample) {
      insert.run(e.title, e.description, e.event_date, e.location, e.status, e.image_url);
    }
    console.log(`[seed] Inserted ${sample.length} sample events.`);
  }
}

migrate();
seed();

module.exports = { db };

// tests/e2e.js
//
// Optional end-to-end smoke test. It spawns its own instance of the server
// against a throwaway database, drives the actual UI with a headless
// browser, and tears everything down afterwards. Not required to run the
// app — only to verify it.
//
// Usage:
//   npm install --save-dev playwright   (one-time; not needed to run the app itself)
//   npm run test:e2e
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const PORT = 4321;
const BASE = `http://localhost:${PORT}`;
const ROOT = path.join(__dirname, '..');
const TEST_DB = path.join(ROOT, 'data', 'test-e2e.db');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${msg}`);
  } else {
    console.log(`ok:   ${msg}`);
  }
}

function cleanupDb() {
  for (const suffix of ['', '-shm', '-wal']) {
    const p = TEST_DB + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function waitForServer(url, timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error('Server did not start in time'));
          } else {
            setTimeout(poll, 200);
          }
        });
    })();
  });
}

async function runBrowserTests() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('  [page error]', err.message));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.event-card', { timeout: 5000 });
  assert((await page.locator('.event-card').count()) >= 3, 'public list shows seeded events');

  await page.fill('#search-input', 'zzz-no-match-zzz');
  await page.waitForTimeout(500);
  assert((await page.locator('.state-block').count()) >= 1, 'search with no matches shows empty state');
  await page.fill('#search-input', '');
  await page.waitForTimeout(500);

  await page.click('.event-card >> nth=0');
  await page.waitForSelector('.title-block', { timeout: 5000 });
  assert((await page.locator('.title-block__row').count()) === 4, 'event detail shows a 4-row title block');

  await page.goto(`${BASE}/admin/dashboard.html`, { waitUntil: 'networkidle' });
  assert(page.url().includes('/admin/login.html'), 'unauthenticated dashboard access redirects to login');

  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin12345');
  await page.click('#submit-btn');
  await page.waitForURL('**/admin/dashboard.html', { timeout: 5000 });
  await page.waitForSelector('.events-table', { timeout: 5000 });
  assert(true, 'valid login reaches the dashboard');

  await page.click('#add-event-btn');
  await page.waitForSelector('.modal-overlay.is-open');
  await page.fill('#title', 'E2E Test Event');
  await page.fill('#description', 'Created by the automated end-to-end test.');
  await page.fill('#event_date', '2027-03-01T09:00');
  await page.fill('#location', 'Test Hall');
  await page.click('#save-event-btn');
  await page.waitForSelector('.modal-overlay.is-open', { state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(400);
  const row = page.locator('tr', { hasText: 'E2E Test Event' });
  assert((await row.count()) === 1, 'created event appears in the dashboard table');

  await row.locator('[data-action="delete"]').click();
  await page.waitForSelector('.modal-overlay.is-open');
  await page.click('#confirm-delete-btn');
  await page.waitForTimeout(400);
  assert((await page.locator('tr', { hasText: 'E2E Test Event' }).count()) === 0, 'deleted event is removed from the table');

  await page.click('#logout-btn');
  await page.waitForURL('**/admin/login.html', { timeout: 5000 });
  assert(true, 'logout returns to the login page');

  await browser.close();
}

(async () => {
  cleanupDb();
  const server = spawn(
    process.execPath,
    [path.join(ROOT, 'server', 'server.js')],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(PORT),
        DB_PATH: TEST_DB,
        JWT_SECRET: 'test-secret',
        SEED_ADMIN_USERNAME: 'admin',
        SEED_ADMIN_PASSWORD: 'admin12345',
      },
      stdio: 'pipe',
    }
  );

  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  try {
    await waitForServer(`${BASE}/api/events`);
    await runBrowserTests();
  } catch (err) {
    failures++;
    console.log('FAIL: unexpected error —', err.message);
  } finally {
    server.kill();
    cleanupDb();
  }

  console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
})();

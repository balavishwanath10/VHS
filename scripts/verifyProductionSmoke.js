import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import healthRouter from '../routes/health.js';
import authRouter from '../routes/auth.js';
import postsRouter from '../routes/posts.js';
import errorHandler, { notFound } from '../middleware/errorHandler.js';
import { validateEnvOrExit } from '../config/validateEnv.js';

dotenv.config();
validateEnvOrExit();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distPath = path.resolve(rootDir, 'dist');

async function runProductionSmokeTest() {
  console.log(`\n==================================================`);
  console.log(`VHS Production Mode Smoke Test`);
  console.log(`==================================================\n`);

  // Build production-mode Express instance identical to server.js in production
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/posts', postsRouter);

  // 404 handler for unmatched API routes
  app.all('/api/*', notFound);

  // Serve static assets from dist
  app.use(express.static(distPath));

  // SPA fallback for non-API routes
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.resolve(distPath, 'index.html'));
  });

  app.use(errorHandler);

  let server;
  let baseURL;

  try {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseURL = `http://localhost:${port}`;
        console.log(`[Smoke Setup] Production test server listening on ${baseURL}\n`);
        resolve();
      });
    });

    // 1. Frontend static assets load: GET /
    const rootRes = await axios.get(baseURL);
    assert.strictEqual(rootRes.status, 200);
    assert.ok(rootRes.data.includes('<div id="root"></div>') || rootRes.data.includes('<!doctype html>'));
    console.log('[PASS] Production Smoke - Root index.html served successfully (HTTP 200)');

    // 2. Frontend static assets load: JavaScript bundle
    const jsAssetPath = '/assets/index-CzV0HXxx.js';
    const jsRes = await axios.get(`${baseURL}${jsAssetPath}`);
    assert.strictEqual(jsRes.status, 200);
    assert.ok(jsRes.headers['content-type'].includes('javascript'));
    console.log(`[PASS] Production Smoke - Static JS bundle served successfully (HTTP 200, Content-Type: ${jsRes.headers['content-type']})`);

    // 3. Frontend static assets load: CSS stylesheet
    const cssAssetPath = '/assets/index-CuVyq5n3.css';
    const cssRes = await axios.get(`${baseURL}${cssAssetPath}`);
    assert.strictEqual(cssRes.status, 200);
    assert.ok(cssRes.headers['content-type'].includes('css'));
    console.log(`[PASS] Production Smoke - Static CSS bundle served successfully (HTTP 200, Content-Type: ${cssRes.headers['content-type']})`);

    // 4. SPA Route Fallback: Client-side routing path returns index.html
    const spaRes = await axios.get(`${baseURL}/explore/developer-stories/react-2026`);
    assert.strictEqual(spaRes.status, 200);
    assert.ok(spaRes.data.includes('<div id="root"></div>') || spaRes.data.includes('<!doctype html>'));
    console.log('[PASS] Production Smoke - SPA fallback correctly serves index.html for non-API client routes (HTTP 200)');

    // 5. API 404 does NOT serve index.html (Strict API separation)
    try {
      await axios.get(`${baseURL}/api/nonexistent-route-xyz`);
      assert.fail('Should have returned 404');
    } catch (err) {
      assert.strictEqual(err.response?.status, 404);
      assert.strictEqual(err.response?.data?.error?.message, 'Resource not found: /api/nonexistent-route-xyz');
      console.log('[PASS] Production Smoke - Unmatched /api/* returns JSON 404 and does not trigger SPA fallback');
    }

    // 6. /api/health reports process and database state
    const healthRes = await axios.get(`${baseURL}/api/health`);
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.data.status, 'ok');
    assert.ok(healthRes.data.database, 'Must include database status object');
    assert.strictEqual(typeof healthRes.data.database.connected, 'boolean');
    console.log('[PASS] Production Smoke - /api/health accurately reports operational status and DB connection state:', healthRes.data.database);

    // 7. Unauthenticated POST /api/posts returns 401
    try {
      await axios.post(`${baseURL}/api/posts`, { title: 'Smoke Test', content: 'Content' });
      assert.fail('Should have returned 401');
    } catch (err) {
      assert.strictEqual(err.response?.status, 401);
      assert.strictEqual(err.response?.data?.error?.message, 'Not authorized, no token provided');
      console.log('[PASS] Production Smoke - Unauthenticated POST /api/posts rejected with HTTP 401 JSON');
    }

    console.log(`\n==================================================`);
    console.log(`PRODUCTION SMOKE TEST: ALL CHECKS PASSED`);
    console.log(`==================================================\n`);

  } catch (err) {
    console.error('[FAIL] Production smoke test error:', err.message);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('[Cleanup] Production smoke test server closed.');
    }
  }
}

runProductionSmokeTest();

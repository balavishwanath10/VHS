import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import axios from 'axios';
import errorHandler, { notFound } from '../middleware/errorHandler.js';

const results = [];

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runErrorHandlingTests() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 4 Centralized Error Handling Verification`);
  console.log(`==================================================\n`);

  let testServer;
  let baseURL;

  try {
    const testApp = express();
    testApp.use(express.json());

    // Test route triggering Mongoose ValidationError
    testApp.post('/api/test-validation', (req, res, next) => {
      const err = new Error('Validation failed');
      err.name = 'ValidationError';
      err.errors = {
        title: { message: 'Title is required' },
        slug: { message: 'Slug must be unique' },
      };
      next(err);
    });

    // Test route triggering CastError
    testApp.get('/api/test-cast/:id', (req, res, next) => {
      const err = new Error('Cast to ObjectId failed');
      err.name = 'CastError';
      err.path = 'author';
      next(err);
    });

    // Test route triggering E11000 duplicate key error
    testApp.post('/api/test-duplicate', (req, res, next) => {
      const err = new Error('E11000 duplicate key error collection');
      err.code = 11000;
      err.keyValue = { email: 'duplicate@example.com' };
      next(err);
    });

    // Test route triggering unexpected 500 error
    testApp.get('/api/test-500', (req, res, next) => {
      next(new Error('Sensitive database connection failure at mongodb+srv://admin:secretPass@cluster.net'));
    });

    // Test route triggering async error via next()
    testApp.get('/api/test-async-error', async (req, res, next) => {
      try {
        await Promise.reject(new Error('Async operation failed'));
      } catch (err) {
        next(err);
      }
    });

    // 404 handler for unmatched /api routes
    testApp.all('/api/*', notFound);

    // Centralized error handler
    testApp.use(errorHandler);

    await new Promise((resolve) => {
      testServer = testApp.listen(0, () => {
        const port = testServer.address().port;
        baseURL = `http://localhost:${port}/api`;
        console.log(`[Setup] Error handling test server listening on port ${port}.\n`);
        resolve();
      });
    });

    // 1. Unknown API GET route returns JSON 404
    try {
      await axios.get(`${baseURL}/unknown-endpoint-12345`);
      recordFail('Error Handling - Unknown API Route 404', new Error('Should have returned 404'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 404, 'Should return HTTP 404');
      assert.strictEqual(
        err.response?.data?.error?.message,
        'Resource not found: /api/unknown-endpoint-12345'
      );
      recordPass('Error Handling - Unknown API Route 404', 'HTTP 404 returned with clean JSON for unknown endpoint');
    }

    // 2. Unknown API POST route returns JSON 404
    try {
      await axios.post(`${baseURL}/some/deep/unmatched/route`, {});
      recordFail('Error Handling - Unknown API POST Route 404', new Error('Should have returned 404'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 404, 'Should return HTTP 404');
      assert.strictEqual(
        err.response?.data?.error?.message,
        'Resource not found: /api/some/deep/unmatched/route'
      );
      recordPass('Error Handling - Unknown API POST Route 404', 'HTTP 404 returned for unmatched POST route');
    }

    // 3. Malformed JSON request body returns safe HTTP 400
    try {
      await axios.post(`${baseURL}/test-validation`, '{"name": invalid_json_syntax', {
        headers: { 'Content-Type': 'application/json' },
      });
      recordFail('Error Handling - Malformed JSON', new Error('Should have returned 400 for malformed JSON'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Should return HTTP 400');
      assert.strictEqual(err.response?.data?.error?.message, 'Malformed JSON in request body');
      recordPass('Error Handling - Malformed JSON', 'HTTP 400 returned with safe message for invalid JSON');
    }

    // 4. Mongoose ValidationError handling
    try {
      await axios.post(`${baseURL}/test-validation`, {});
      recordFail('Error Handling - Mongoose ValidationError', new Error('Should have returned 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Should return HTTP 400');
      assert.ok(err.response?.data?.error?.message.includes('Title is required'));
      assert.ok(err.response?.data?.error?.message.includes('Slug must be unique'));
      recordPass('Error Handling - Mongoose ValidationError', 'Formatted validation messages returned on schema validation failure');
    }

    // 5. Mongoose CastError handling (Invalid ObjectId)
    try {
      await axios.get(`${baseURL}/test-cast/invalid-id`);
      recordFail('Error Handling - Mongoose CastError', new Error('Should have returned 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Should return HTTP 400');
      assert.strictEqual(err.response?.data?.error?.message, 'Invalid identifier format for field: author');
      recordPass('Error Handling - Mongoose CastError', 'Clean invalid identifier message returned on CastError');
    }

    // 6. MongoDB Duplicate Key Error (E11000)
    try {
      await axios.post(`${baseURL}/test-duplicate`, {});
      recordFail('Error Handling - Duplicate Key E11000', new Error('Should have returned 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Should return HTTP 400');
      assert.ok(err.response?.data?.error?.message.includes('Duplicate value entered for email'));
      recordPass('Error Handling - Duplicate Key E11000', 'Safe duplicate entry message returned on E11000 error');
    }

    // 7. Asynchronous route errors reach centralized handler
    try {
      await axios.get(`${baseURL}/test-async-error`);
      recordFail('Error Handling - Async Route Error', new Error('Should have returned 500'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 500, 'Should return HTTP 500');
      assert.strictEqual(err.response?.data?.error?.message, 'Async operation failed');
      recordPass('Error Handling - Async Route Error', 'Async error caught and passed to centralized errorHandler');
    }

    // 8. Production response safety for unexpected 500 errors
    // Test production mode behavior directly
    try {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      let statusCode;
      let responseBody;
      const mockReq = {};
      const mockRes = {
        statusCode: 500,
        status(code) { statusCode = code; return this; },
        json(data) { responseBody = data; return this; },
      };
      const sensitiveError = new Error('Sensitive internal error with secret: mongodb+srv://user:pass@cluster.net');
      sensitiveError.stack = 'Secret stack trace with paths and credentials';

      errorHandler(sensitiveError, mockReq, mockRes, () => {});

      process.env.NODE_ENV = origEnv;

      assert.strictEqual(statusCode, 500);
      assert.strictEqual(responseBody.error.message, 'Internal Server Error', 'Must be generic 500 in production');
      assert.strictEqual(responseBody.error.stack, undefined, 'Stack trace must be undefined in production');
      assert.strictEqual(JSON.stringify(responseBody).includes('secret'), false, 'Must not leak secrets');
      recordPass('Error Handling - Production Response Safety', '500 errors masked to generic message and stack omitted in production');
    } catch (err) {
      recordFail('Error Handling - Production Response Safety', err);
    }

    // 9. Development diagnostics retain stack trace
    try {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      let responseBody;
      const mockReq = {};
      const mockRes = {
        statusCode: 500,
        status() { return this; },
        json(data) { responseBody = data; return this; },
      };
      const devError = new Error('Development debug info');
      devError.stack = 'Error: Development debug info\n    at ...';

      errorHandler(devError, mockReq, mockRes, () => {});

      process.env.NODE_ENV = origEnv;

      assert.strictEqual(responseBody.error.message, 'Development debug info');
      assert.ok(responseBody.error.stack, 'Stack trace preserved in development');
      recordPass('Error Handling - Development Diagnostics', 'Useful diagnostic message and stack preserved in development');
    } catch (err) {
      recordFail('Error Handling - Development Diagnostics', err);
    }

  } catch (globalErr) {
    console.error('Fatal error in error handling tests:', globalErr);
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
      console.log('[Cleanup] Error handling test server closed.');
    }
  }

  console.log(`\n==================================================`);
  console.log(`TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.length === 0 || results.some((r) => r.status === 'FAIL');
  process.exitCode = hasFailures ? 1 : 0;
}

runErrorHandlingTests();

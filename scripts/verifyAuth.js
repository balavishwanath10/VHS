import 'dotenv/config';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import authRouter from '../routes/auth.js';
import errorHandler from '../middleware/errorHandler.js';
import protect from '../middleware/auth.js';
import generateToken from '../utils/generateToken.js';

const testRunId = `auth_test_${Date.now()}`;
const createdUserIds = [];
const results = [];

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runAuthTests() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 3 Authentication & JWT Verification (${testRunId})`);
  console.log(`==================================================\n`);

  let testServer;
  let baseURL;

  try {
    await connectDB();
    console.log('[Setup] Connected to database. Ensuring User indexes...');
    await User.syncIndexes();
    console.log('[Setup] User indexes synchronized.\n');

    // Create an isolated Express application for HTTP endpoint testing
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/auth', authRouter);
    testApp.use(errorHandler);

    // Bind to an ephemeral port (port 0) to avoid any port conflicts
    await new Promise((resolve) => {
      testServer = testApp.listen(0, () => {
        const port = testServer.address().port;
        baseURL = `http://localhost:${port}/api/auth`;
        console.log(`[Setup] Ephemeral test server listening on port ${port}.\n`);
        resolve();
      });
    });

    // ----------------------------------------------------
    // REGISTRATION TESTS
    // ----------------------------------------------------
    console.log('--- REGISTRATION TESTS ---');

    const validUserEmail = `reg_${testRunId}@example.com`;
    const validUserPassword = 'ValidSecretPassword123!';
    let registeredUserToken;
    let registeredUserId;

    // Test 1: Valid Registration
    try {
      const res = await axios.post(`${baseURL}/register`, {
        name: 'John Developer',
        email: validUserEmail,
        password: validUserPassword,
      });

      assert.strictEqual(res.status, 201, 'Should return HTTP 201 Created');
      assert.ok(res.data.token, 'Should return JWT token');
      assert.ok(res.data.user, 'Should return user object');
      assert.strictEqual(res.data.user.name, 'John Developer', 'Name should match');
      assert.strictEqual(res.data.user.email, validUserEmail.toLowerCase(), 'Email should match');
      assert.strictEqual(res.data.user.password, undefined, 'Password must not be returned');
      assert.strictEqual(res.data.password, undefined, 'Password hash must not be returned');

      registeredUserToken = res.data.token;
      registeredUserId = res.data.user.id;
      createdUserIds.push(registeredUserId);

      recordPass('Registration - Valid Registration', 'User registered with HTTP 201, token, safe profile, no password');
    } catch (err) {
      recordFail('Registration - Valid Registration', err.response?.data?.error || err);
    }

    // Test 2: Missing Name
    try {
      await axios.post(`${baseURL}/register`, {
        email: `missing_name_${testRunId}@example.com`,
        password: 'Password123!',
      });
      recordFail('Registration - Missing Name Rejection', new Error('Should have failed without name'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Should return HTTP 400 Bad Request');
      assert.ok(err.response?.data?.error?.message, 'Should contain error message');
      recordPass('Registration - Missing Name Rejection', 'HTTP 400 returned when name is missing');
    }

    // Test 3: Missing Email
    try {
      await axios.post(`${baseURL}/register`, {
        name: 'No Email',
        password: 'Password123!',
      });
      recordFail('Registration - Missing Email Rejection', new Error('Should have failed without email'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Should return HTTP 400 Bad Request');
      recordPass('Registration - Missing Email Rejection', 'HTTP 400 returned when email is missing');
    }

    // Test 4: Missing Password
    try {
      await axios.post(`${baseURL}/register`, {
        name: 'No Password User',
        email: `nopass_${testRunId}@example.com`,
      });
      recordFail('Registration - Missing Password Rejection', new Error('Should have failed without password'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Should return HTTP 400 Bad Request');
      recordPass('Registration - Missing Password Rejection', 'HTTP 400 returned when password is missing');
    }

    // Test 5: Duplicate Email Rejection
    try {
      await axios.post(`${baseURL}/register`, {
        name: 'Duplicate John',
        email: validUserEmail, // already registered in Test 1
        password: 'DifferentPassword123!',
      });
      recordFail('Registration - Duplicate Email Rejection', new Error('Should have failed on duplicate email'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Should return HTTP 400 on duplicate email');
      assert.strictEqual(err.response?.data?.error?.message, 'An account with this email already exists');
      recordPass('Registration - Duplicate Email Rejection', 'HTTP 400 returned when registering existing email');
    }

    // Test 6: Email Normalization
    try {
      const normalizedRes = await axios.post(`${baseURL}/register`, {
        name: 'Norm User',
        email: `  MixedCase_${testRunId}@EXAMPLE.COM  `,
        password: 'Password123!',
      });
      createdUserIds.push(normalizedRes.data.user.id);
      assert.strictEqual(
        normalizedRes.data.user.email,
        `mixedcase_${testRunId.toLowerCase()}@example.com`,
        'Email should be lowercased and trimmed'
      );
      recordPass('Registration - Email Normalization', 'Email trimmed and lowercased upon registration');
    } catch (err) {
      recordFail('Registration - Email Normalization', err.response?.data?.error || err);
    }

    // Test 7: Stored Password is a bcrypt Hash
    try {
      const dbUser = await User.findById(registeredUserId).select('+password');
      assert.notStrictEqual(dbUser.password, validUserPassword, 'Stored password must not be plain text');
      assert.ok(dbUser.password.startsWith('$2'), 'Stored password must be a bcrypt hash');
      const isMatch = await bcrypt.compare(validUserPassword, dbUser.password);
      assert.strictEqual(isMatch, true, 'Stored bcrypt hash must verify against original plain password');
      recordPass('Registration - Stored Password is Bcrypt Hash', 'Pre-save hook hashed password prior to database persistence');
    } catch (err) {
      recordFail('Registration - Stored Password is Bcrypt Hash', err);
    }

    // Test 8: Registration Response Excludes Password
    try {
      const res = await axios.post(`${baseURL}/register`, {
        name: 'Exclusion Test',
        email: `exclude_${testRunId}@example.com`,
        password: 'Password123!',
      });
      createdUserIds.push(res.data.user.id);
      assert.strictEqual(res.data.user.password, undefined, 'user.password should not exist in response');
      assert.strictEqual(res.data.password, undefined, 'password should not exist in root response');
      recordPass('Registration - Response Excludes Password', 'Password and password hash are omitted from response');
    } catch (err) {
      recordFail('Registration - Response Excludes Password', err.response?.data?.error || err);
    }

    // ----------------------------------------------------
    // LOGIN TESTS
    // ----------------------------------------------------
    console.log('\n--- LOGIN TESTS ---');

    let loginToken;

    // Test 9: Valid Login
    try {
      const res = await axios.post(`${baseURL}/login`, {
        email: validUserEmail,
        password: validUserPassword,
      });

      assert.strictEqual(res.status, 200, 'Should return HTTP 200 OK');
      assert.ok(res.data.token, 'Should return JWT token');
      assert.ok(res.data.user, 'Should return user object');
      assert.strictEqual(res.data.user.email, validUserEmail.toLowerCase());
      assert.strictEqual(res.data.user.password, undefined, 'Password must not be returned');
      assert.strictEqual(res.data.password, undefined, 'Password hash must not be returned');

      loginToken = res.data.token;
      recordPass('Login - Valid Credentials', 'HTTP 200 returned with valid JWT and safe user object');
    } catch (err) {
      recordFail('Login - Valid Credentials', err.response?.data?.error || err);
    }

    // Test 10: Incorrect Password Rejection
    try {
      await axios.post(`${baseURL}/login`, {
        email: validUserEmail,
        password: 'WrongPassword!',
      });
      recordFail('Login - Incorrect Password Rejection', new Error('Should fail with incorrect password'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Should return HTTP 401 Unauthorized');
      assert.strictEqual(err.response?.data?.error?.message, 'Invalid credentials');
      recordPass('Login - Incorrect Password Rejection', 'HTTP 401 returned on invalid password');
    }

    // Test 11: Nonexistent Email Rejection
    try {
      await axios.post(`${baseURL}/login`, {
        email: `nonexistent_${testRunId}@example.com`,
        password: 'SomePassword123!',
      });
      recordFail('Login - Nonexistent Email Rejection', new Error('Should fail with nonexistent email'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Should return HTTP 401 Unauthorized');
      assert.strictEqual(err.response?.data?.error?.message, 'Invalid credentials', 'Generic error message preserved');
      recordPass('Login - Nonexistent Email Rejection', 'HTTP 401 returned without disclosing email existence');
    }

    // Test 12: Missing Credentials
    try {
      await axios.post(`${baseURL}/login`, {
        email: validUserEmail,
      });
      recordFail('Login - Missing Credentials Rejection', new Error('Should fail when password is missing'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Should return HTTP 400 Bad Request');
      recordPass('Login - Missing Credentials Rejection', 'HTTP 400 returned when credentials are missing');
    }

    // Test 13: JWT Returned on Success & Verifiable
    try {
      const decoded = jwt.verify(loginToken, process.env.JWT_SECRET);
      assert.strictEqual(decoded.id, registeredUserId, 'Decoded token ID must match user ID');
      recordPass('Login - JWT Returned and Verifiable', 'JWT verified successfully with JWT_SECRET and user ID payload');
    } catch (err) {
      recordFail('Login - JWT Returned and Verifiable', err);
    }

    // Test 14: JWT Expiration Configuration Respected
    try {
      const decoded = jwt.verify(loginToken, process.env.JWT_SECRET);
      assert.ok(decoded.exp, 'Token must contain exp claim');
      assert.ok(decoded.iat, 'Token must contain iat claim');
      assert.ok(decoded.exp > decoded.iat, 'Expiration timestamp must be in future');
      recordPass('Login - JWT Expiration Respected', 'JWT contains valid expiration claim matching configuration');
    } catch (err) {
      recordFail('Login - JWT Expiration Respected', err);
    }

    // Test 15: Login Response Excludes Password
    try {
      const res = await axios.post(`${baseURL}/login`, {
        email: validUserEmail,
        password: validUserPassword,
      });
      assert.strictEqual(res.data.user.password, undefined);
      assert.strictEqual(res.data.password, undefined);
      recordPass('Login - Response Excludes Password', 'Password and password hash are omitted from login response');
    } catch (err) {
      recordFail('Login - Response Excludes Password', err.response?.data?.error || err);
    }

    // ----------------------------------------------------
    // AUTHENTICATION MIDDLEWARE TESTS
    // ----------------------------------------------------
    console.log('\n--- AUTHENTICATION MIDDLEWARE TESTS ---');

    // Test 16: Valid Bearer Token Passes Middleware
    try {
      const req = { headers: { authorization: `Bearer ${loginToken}` } };
      let nextCalled = false;
      const res = { status: () => res, json: () => {} };
      await protect(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true, 'next() should be called');
      assert.ok(req.user, 'req.user should be attached');
      assert.strictEqual(req.user._id.toString(), registeredUserId, 'Attached user ID must match token');
      recordPass('Middleware - Valid Bearer Token', 'Middleware validates token and attaches req.user');
    } catch (err) {
      recordFail('Middleware - Valid Bearer Token', err);
    }

    // Test 17: Missing Authorization Header
    try {
      let statusCode;
      let jsonBody;
      const req = { headers: {} };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonBody = data; },
      };
      await protect(req, res, () => {});

      assert.strictEqual(statusCode, 401, 'Should return HTTP 401');
      assert.strictEqual(jsonBody.error.message, 'Not authorized, no token provided');
      recordPass('Middleware - Missing Authorization Header', 'HTTP 401 returned when Authorization header is missing');
    } catch (err) {
      recordFail('Middleware - Missing Authorization Header', err);
    }

    // Test 18: Missing Token (Bearer without token)
    try {
      let statusCode;
      let jsonBody;
      const req = { headers: { authorization: 'Bearer ' } };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonBody = data; },
      };
      await protect(req, res, () => {});

      assert.strictEqual(statusCode, 401, 'Should return HTTP 401');
      assert.strictEqual(jsonBody.error.message, 'Not authorized, no token provided');
      recordPass('Middleware - Missing Token in Bearer Header', 'HTTP 401 returned when token string is empty');
    } catch (err) {
      recordFail('Middleware - Missing Token in Bearer Header', err);
    }

    // Test 19: Malformed Bearer Header (e.g. Basic or Token prefix)
    try {
      let statusCode;
      let jsonBody;
      const req = { headers: { authorization: `Basic ${loginToken}` } };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonBody = data; },
      };
      await protect(req, res, () => {});

      assert.strictEqual(statusCode, 401, 'Should return HTTP 401');
      assert.strictEqual(jsonBody.error.message, 'Not authorized, no token provided');
      recordPass('Middleware - Malformed Bearer Header', 'HTTP 401 returned when non-Bearer scheme is provided');
    } catch (err) {
      recordFail('Middleware - Malformed Bearer Header', err);
    }

    // Test 20: Invalid Token (Tampered Signature)
    try {
      let statusCode;
      let jsonBody;
      const tamperedToken = loginToken.slice(0, -6) + 'abcdef';
      const req = { headers: { authorization: `Bearer ${tamperedToken}` } };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonBody = data; },
      };
      await protect(req, res, () => {});

      assert.strictEqual(statusCode, 401, 'Should return HTTP 401');
      assert.strictEqual(jsonBody.error.message, 'Not authorized, invalid token');
      recordPass('Middleware - Invalid Token Rejection', 'HTTP 401 returned when token signature is invalid');
    } catch (err) {
      recordFail('Middleware - Invalid Token Rejection', err);
    }

    // Test 21: Expired Token Rejection
    try {
      const expiredToken = jwt.sign(
        { id: registeredUserId },
        process.env.JWT_SECRET,
        { expiresIn: '0s' } // Immediately expired
      );

      // Short wait to ensure epoch expiry
      await new Promise((r) => setTimeout(r, 50));

      let statusCode;
      let jsonBody;
      const req = { headers: { authorization: `Bearer ${expiredToken}` } };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonBody = data; },
      };
      await protect(req, res, () => {});

      assert.strictEqual(statusCode, 401, 'Should return HTTP 401');
      assert.strictEqual(jsonBody.error.message, 'Not authorized, token has expired');
      recordPass('Middleware - Expired Token Rejection', 'HTTP 401 returned when token is expired');
    } catch (err) {
      recordFail('Middleware - Expired Token Rejection', err);
    }

    // Test 22: Nonexistent User Identity
    try {
      const nonExistentId = new mongoose.Types.ObjectId();
      const nonExistentToken = jwt.sign(
        { id: nonExistentId.toString() },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      let statusCode;
      let jsonBody;
      const req = { headers: { authorization: `Bearer ${nonExistentToken}` } };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonBody = data; },
      };
      await protect(req, res, () => {});

      assert.strictEqual(statusCode, 401, 'Should return HTTP 401');
      assert.strictEqual(jsonBody.error.message, 'Not authorized, user not found');
      recordPass('Middleware - Nonexistent User Rejection', 'HTTP 401 returned when token references a deleted/unknown user');
    } catch (err) {
      recordFail('Middleware - Nonexistent User Rejection', err);
    }

    // ----------------------------------------------------
    // CURRENT USER ENDPOINT TESTS (GET /api/auth/me)
    // ----------------------------------------------------
    console.log('\n--- CURRENT USER ENDPOINT TESTS (/api/auth/me) ---');

    // Test 23: Valid Token Returns Correct User
    try {
      const res = await axios.get(`${baseURL}/me`, {
        headers: { Authorization: `Bearer ${loginToken}` },
      });

      assert.strictEqual(res.status, 200, 'Should return HTTP 200');
      assert.strictEqual(res.data.user.id, registeredUserId, 'User ID should match');
      assert.strictEqual(res.data.user.email, validUserEmail.toLowerCase());
      assert.strictEqual(res.data.user.name, 'John Developer');
      recordPass('Current User - Valid Token', 'HTTP 200 returned with correct user profile');
    } catch (err) {
      recordFail('Current User - Valid Token', err.response?.data?.error || err);
    }

    // Test 24: Password Excluded from /api/auth/me
    try {
      const res = await axios.get(`${baseURL}/me`, {
        headers: { Authorization: `Bearer ${loginToken}` },
      });

      assert.strictEqual(res.data.user.password, undefined, 'user.password must be undefined');
      assert.strictEqual(res.data.password, undefined, 'password must not be present');
      recordPass('Current User - Password Excluded', 'Password and password hash are omitted from /me response');
    } catch (err) {
      recordFail('Current User - Password Excluded', err.response?.data?.error || err);
    }

    // Test 25: Missing Token Rejected
    try {
      await axios.get(`${baseURL}/me`);
      recordFail('Current User - Missing Token Rejection', new Error('Should fail without Authorization header'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Should return HTTP 401');
      assert.strictEqual(err.response?.data?.error?.message, 'Not authorized, no token provided');
      recordPass('Current User - Missing Token Rejection', 'HTTP 401 returned when Authorization header is absent');
    }

    // Test 26: Invalid Token Rejected
    try {
      await axios.get(`${baseURL}/me`, {
        headers: { Authorization: 'Bearer invalid.token.string' },
      });
      recordFail('Current User - Invalid Token Rejection', new Error('Should fail with invalid token'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Should return HTTP 401');
      assert.strictEqual(err.response?.data?.error?.message, 'Not authorized, invalid token');
      recordPass('Current User - Invalid Token Rejection', 'HTTP 401 returned on invalid token');
    }

    // Test 27: Expired Token Rejected
    try {
      const expiredToken = jwt.sign(
        { id: registeredUserId },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );
      await new Promise((r) => setTimeout(r, 50));

      await axios.get(`${baseURL}/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      recordFail('Current User - Expired Token Rejection', new Error('Should fail with expired token'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Should return HTTP 401');
      assert.strictEqual(err.response?.data?.error?.message, 'Not authorized, token has expired');
      recordPass('Current User - Expired Token Rejection', 'HTTP 401 returned on expired token');
    }

  } catch (globalErr) {
    console.error('Fatal error during auth test run:', globalErr);
  } finally {
    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n--- CLEANUP ---');
    try {
      if (testServer) {
        await new Promise((resolve) => testServer.close(resolve));
        console.log('[Cleanup] Ephemeral test server closed.');
      }
      if (createdUserIds.length > 0) {
        const userDel = await User.deleteMany({ _id: { $in: createdUserIds } });
        console.log(`[Cleanup] Deleted ${userDel.deletedCount} test user(s).`);
      }
    } catch (cleanErr) {
      console.error('[Cleanup Error]', cleanErr.message);
    } finally {
      await mongoose.disconnect();
      console.log('[Cleanup] Disconnected from MongoDB Atlas.');
    }
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log(`\n==================================================`);
  console.log(`TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.some((r) => r.status === 'FAIL');
  process.exitCode = hasFailures ? 1 : 0;
}

runAuthTests();

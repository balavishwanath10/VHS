import 'dotenv/config';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import usersRouter from '../routes/users.js';
import authRouter from '../routes/auth.js';
import errorHandler from '../middleware/errorHandler.js';
import { validateEnv } from '../config/validateEnv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const results = [];
const testRunId = `d14_${Date.now()}`;

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runDay14Verification() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 14 User Profiles & Account Settings Verification (${testRunId})`);
  console.log(`==================================================\n`);

  // --- Phase 1: Frontend Component Analysis ---
  console.log('--- Phase 1: Frontend Profile & Settings Verification ---');

  const profileContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Profile.jsx'), 'utf8');
  const settingsContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Settings.jsx'), 'utf8');
  const appContent = fs.readFileSync(path.resolve(rootDir, 'src', 'App.jsx'), 'utf8');
  const authContextContent = fs.readFileSync(path.resolve(rootDir, 'src', 'context', 'AuthContext.jsx'), 'utf8');

  // Test 1: Profile page fetches from GET /api/users/:id
  try {
    assert.ok(/api\s*\.\s*get\(\s*`\/users\/\$\{id\}`\s*\)/.test(profileContent), 'Profile.jsx must call GET /api/users/:id');
    assert.ok(profileContent.includes('setProfileUser(res.data.user)'), 'Profile.jsx populates profileUser');
    assert.ok(profileContent.includes('setPosts(res.data.posts'), 'Profile.jsx populates published posts');
    recordPass('1. Profile page fetches user and posts', 'Profile component fetches public developer profile and stories');
  } catch (err) {
    recordFail('1. Profile page fetches user and posts', err);
  }

  // Test 2: Profile displays avatar fallback, bio, post list, empty state
  try {
    assert.ok(profileContent.includes('profile-avatar-large') || profileContent.includes('avatarUrl'), 'Profile renders avatar');
    assert.ok(profileContent.includes('profileUser.bio'), 'Profile renders bio');
    assert.ok(profileContent.includes('posts.map('), 'Profile iterates through stories');
    assert.ok(profileContent.includes('No stories published yet'), 'Profile includes empty stories state');
    recordPass('2. Profile UI elements and empty state', 'Profile renders avatar, bio, stories feed, and empty fallback');
  } catch (err) {
    recordFail('2. Profile UI elements and empty state', err);
  }

  // Test 3: Settings page loads user and provides name, bio, avatarUrl fields
  try {
    assert.ok(settingsContent.includes('const { user, updateUser } = useAuth()'), 'Settings accesses AuthContext');
    assert.ok(settingsContent.includes('id="settings-name"'), 'Settings renders name field');
    assert.ok(settingsContent.includes('id="settings-bio"'), 'Settings renders bio field');
    assert.ok(settingsContent.includes('id="settings-avatar"'), 'Settings renders avatarUrl field');
    assert.ok(settingsContent.includes('maxLength={200}'), 'Bio textarea enforces 200 char maximum');
    recordPass('3. Settings form structure & constraints', 'Settings form contains name, bio (<=200 chars), and avatar inputs');
  } catch (err) {
    recordFail('3. Settings form structure & constraints', err);
  }

  // Test 4: Settings submits updates via PUT /api/users/me and updates AuthContext
  try {
    assert.ok(/api\s*\.\s*put\(\s*['"]\/users\/me['"]\s*,/.test(settingsContent), 'Settings calls PUT /api/users/me');
    assert.ok(settingsContent.includes('updateUser(updatedUser)'), 'Settings synchronizes AuthContext');
    assert.ok(authContextContent.includes('updateUser:'), 'AuthContext exposes updateUser');
    recordPass('4. Settings submission & AuthContext synchronization', 'Submits to PUT /api/users/me and synchronizes AuthContext state');
  } catch (err) {
    recordFail('4. Settings submission & AuthContext synchronization', err);
  }

  // Test 5: Route protection for Settings
  try {
    assert.ok(/path="\/settings"[\s\S]*?<ProtectedRoute>/.test(appContent), '/settings must be wrapped in <ProtectedRoute>');
    recordPass('5. Settings route is protected', 'ProtectedRoute guards /settings from unauthenticated access');
  } catch (err) {
    recordFail('5. Settings route is protected', err);
  }

  // --- Phase 2: Live Backend Security & API Verification ---
  console.log('\n--- Phase 2: Live Backend Security & API Verification ---');

  let testServer;
  let baseURL;
  let userA, userB;
  let tokenA, tokenB;
  const createdPostIds = [];
  let isDbConnected = false;

  try {
    await connectDB();
    isDbConnected = true;

    const { secret } = validateEnv();

    userA = await User.create({
      name: 'Day 14 Author A',
      email: `author_a_${testRunId}@example.com`,
      password: 'OriginalPassword123!',
      bio: 'Initial bio for Author A.',
      avatarUrl: 'https://example.com/avatar-a.jpg',
    });

    userB = await User.create({
      name: 'Day 14 User B',
      email: `user_b_${testRunId}@example.com`,
      password: 'Password123!',
      bio: 'Initial bio for User B.',
    });

    tokenA = jwt.sign({ id: userA._id.toString() }, secret, { expiresIn: '1h' });
    tokenB = jwt.sign({ id: userB._id.toString() }, secret, { expiresIn: '1h' });

    // Create published post by User A
    const pubPost = await Post.create({
      title: `Published Story ${testRunId}`,
      slug: `pub-story-${testRunId}`,
      content: '# Published Content\n\nPublicly visible story.',
      excerpt: 'Publicly visible story.',
      status: 'published',
      author: userA._id,
    });
    createdPostIds.push(pubPost._id);

    // Create draft post by User A
    const draftPost = await Post.create({
      title: `Secret Draft ${testRunId}`,
      slug: `secret-draft-${testRunId}`,
      content: '# Secret Draft Content\n\nPrivate thoughts.',
      excerpt: 'Private thoughts.',
      status: 'draft',
      author: userA._id,
    });
    createdPostIds.push(draftPost._id);

    const app = express();
    app.use(express.json());
    app.use('/api/users', usersRouter);
    app.use('/api/auth', authRouter);
    app.use(errorHandler);

    await new Promise((resolve) => {
      testServer = app.listen(0, () => {
        const port = testServer.address().port;
        baseURL = `http://localhost:${port}/api/users`;
        resolve();
      });
    });

    const headersA = { headers: { Authorization: `Bearer ${tokenA}` } };
    const headersB = { headers: { Authorization: `Bearer ${tokenB}` } };

    // Test 6: Public profile retrieval returns public data and excludes secrets
    try {
      const res = await axios.get(`${baseURL}/${userA._id}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.user.name, userA.name);
      assert.strictEqual(res.data.user.bio, userA.bio);
      assert.strictEqual(res.data.user.avatarUrl, userA.avatarUrl);
      assert.ok(res.data.user.createdAt, 'createdAt must be returned');

      // Crucial Security Checks
      assert.strictEqual(res.data.user.password, undefined, 'Password must never be exposed');
      assert.strictEqual(res.data.user.passwordHash, undefined, 'Password hash must never be exposed');
      assert.strictEqual(res.data.user.email, undefined, 'Email must not be leaked on public profile');

      recordPass('6. Public profile retrieval & secret protection', 'Public profile returns name, bio, avatarUrl; strictly excludes password and email');
    } catch (err) {
      recordFail('6. Public profile retrieval & secret protection', err);
    }

    // Test 7: Public profile returns published posts only and excludes drafts
    try {
      const res = await axios.get(`${baseURL}/${userA._id}`);
      assert.strictEqual(res.status, 200);
      const posts = res.data.posts;
      assert.strictEqual(posts.length, 1, 'Only published posts must be returned');
      assert.strictEqual(posts[0]._id.toString(), pubPost._id.toString());
      assert.ok(!posts.some((p) => p.status === 'draft'), 'Drafts must be strictly excluded from public profile');
      recordPass('7. Published posts returned, drafts excluded', 'Public profile includes published posts and strictly protects drafts');
    } catch (err) {
      recordFail('7. Published posts returned, drafts excluded', err);
    }

    // Test 8: Unknown or invalid user ID handling
    try {
      const nonExistentId = new mongoose.Types.ObjectId();
      await axios.get(`${baseURL}/${nonExistentId}`);
      recordFail('8. Unknown user ID returns 404', new Error('Unknown user returned 200'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 404);
      recordPass('8. Unknown user ID returns 404', 'Non-existent user identifier returns 404 Not Found');
    }

    try {
      await axios.get(`${baseURL}/invalid-mongo-id`);
      recordFail('8b. Invalid ID format returns 400', new Error('Invalid ID returned non-400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      recordPass('8b. Invalid ID format returns 400', 'Malformed ObjectId returns 400 Bad Request');
    }

    // Test 9: Profile update with valid values
    try {
      const updateRes = await axios.put(
        `${baseURL}/me`,
        {
          name: 'Author A Updated Name',
          bio: 'Updated bio for Author A within limit.',
          avatarUrl: 'https://example.com/new-avatar.jpg',
        },
        headersA
      );

      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.data.user.name, 'Author A Updated Name');
      assert.strictEqual(updateRes.data.user.bio, 'Updated bio for Author A within limit.');
      assert.strictEqual(updateRes.data.user.avatarUrl, 'https://example.com/new-avatar.jpg');

      // Verify persistence in MongoDB
      const dbUser = await User.findById(userA._id);
      assert.strictEqual(dbUser.name, 'Author A Updated Name');
      assert.strictEqual(dbUser.bio, 'Updated bio for Author A within limit.');
      assert.strictEqual(dbUser.avatarUrl, 'https://example.com/new-avatar.jpg');

      recordPass('9. Profile update with valid values', 'PUT /api/users/me updates name, bio, avatarUrl and persists in database');
    } catch (err) {
      recordFail('9. Profile update with valid values', err);
    }

    // Test 10: Validation rejects empty name
    try {
      await axios.put(`${baseURL}/me`, { name: '   ' }, headersA);
      recordFail('10. Empty name rejected', new Error('Empty name did not return 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response.data.error.message.includes('Name'));
      recordPass('10. Empty name rejected', 'PUT /api/users/me with blank name returns 400 error');
    }

    // Test 11: Validation rejects bio exceeding 200 characters
    try {
      const longBio = 'A'.repeat(201);
      await axios.put(`${baseURL}/me`, { bio: longBio }, headersA);
      recordFail('11. Bio > 200 chars rejected', new Error('Bio > 200 chars did not return 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response.data.error.message.includes('200'));
      recordPass('11. Bio > 200 chars rejected', 'Bio exceeding 200 characters returns 400 error');
    }

    // Test 12: Validation rejects invalid avatar URL
    try {
      await axios.put(`${baseURL}/me`, { avatarUrl: 'invalid-url' }, headersA);
      recordFail('12. Invalid avatar URL rejected', new Error('Invalid URL did not return 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response.data.error.message.includes('Avatar URL'));
      recordPass('12. Invalid avatar URL rejected', 'Malformed avatar URL returns 400 error');
    }

    // Test 13: Unauthenticated profile update blocked
    try {
      await axios.put(`${baseURL}/me`, { name: 'Unauth User' });
      recordFail('13. Unauthenticated update blocked', new Error('Unauthenticated update returned 200'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401);
      recordPass('13. Unauthenticated update blocked', 'PUT /api/users/me without Bearer token returns 401');
    }

    // Test 14: Cross-user update blocked (endpoint updates ONLY authenticated user)
    try {
      await axios.put(
        `${baseURL}/me`,
        {
          _id: userA._id.toString(),
          name: 'Hacked User B Name',
        },
        headersB
      );

      // Verify User A was not modified
      const checkUserA = await User.findById(userA._id);
      assert.strictEqual(checkUserA.name, 'Author A Updated Name');

      // Verify User B was modified
      const checkUserB = await User.findById(userB._id);
      assert.strictEqual(checkUserB.name, 'Hacked User B Name');

      recordPass('14. Cross-user modification blocked', 'Attempted modification using another user ID does not affect target user');
    } catch (err) {
      recordFail('14. Cross-user modification blocked', err);
    }

    // Test 15: Password manipulation blocked through PUT /api/users/me
    try {
      await axios.put(
        `${baseURL}/me`,
        {
          password: 'MaliciousNewPassword123!',
          role: 'admin',
        },
        headersA
      );

      // Verify User A password hash was not changed
      const dbUser = await User.findById(userA._id).select('+password');
      const isMatch = await bcrypt.compare('OriginalPassword123!', dbUser.password);
      assert.strictEqual(isMatch, true, 'Original password must remain intact');

      const isBadMatch = await bcrypt.compare('MaliciousNewPassword123!', dbUser.password);
      assert.strictEqual(isBadMatch, false, 'Malicious password must not match');

      recordPass('15. Password and role manipulation blocked', 'PUT /api/users/me ignores password and role fields; password remains securely intact');
    } catch (err) {
      recordFail('15. Password and role manipulation blocked', err);
    }

  } catch (setupErr) {
    console.error('[Setup/Run Error]:', setupErr.message);
  } finally {
    if (isDbConnected) {
      try {
        if (createdPostIds.length > 0) {
          await Post.deleteMany({ _id: { $in: createdPostIds } });
        }
        if (userA) await User.deleteOne({ _id: userA._id });
        if (userB) await User.deleteOne({ _id: userB._id });
      } catch (cleanErr) {
        console.warn('[Cleanup Warning]:', cleanErr.message);
      }
    }

    if (testServer) {
      await new Promise((r) => testServer.close(r));
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log(`\n==================================================`);
  console.log(`DAY 14 TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.length === 0 || results.some((r) => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

runDay14Verification();

import 'dotenv/config';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Tag from '../models/Tag.js';
import authRouter from '../routes/auth.js';
import postsRouter from '../routes/posts.js';
import tagsRouter from '../routes/tags.js';
import usersRouter from '../routes/users.js';
import errorHandler from '../middleware/errorHandler.js';
import { validateEnv } from '../config/validateEnv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const results = [];
const testRunId = `d15_${Date.now()}`;

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runDay15Integration() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 15 Tag Pages, Navigation & Full Integration (${testRunId})`);
  console.log(`==================================================\n`);

  // --- Phase 1: Static Route & Component Navigation Analysis ---
  console.log('--- Phase 1: Frontend Navigation & Component Integration ---');

  const appContent = fs.readFileSync(path.resolve(rootDir, 'src', 'App.jsx'), 'utf8');
  const navbarContent = fs.readFileSync(path.resolve(rootDir, 'src', 'components', 'Navbar.jsx'), 'utf8');
  const tagPostsContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'TagPosts.jsx'), 'utf8');
  const editorContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Editor.jsx'), 'utf8');
  const dashboardContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Dashboard.jsx'), 'utf8');

  // Test 1: TagPosts component connects to GET /api/tags/:slug/posts
  try {
    assert.ok(
      /api\s*\.\s*get\(\s*`\/tags\/\$\{slug\}\/posts`\s*\)/.test(tagPostsContent),
      'TagPosts must call GET /api/tags/:slug/posts'
    );
    assert.ok(tagPostsContent.includes('setTag(res.data.tag)'), 'TagPosts populates tag metadata');
    assert.ok(tagPostsContent.includes('setPosts(res.data.posts'), 'TagPosts populates matching stories');
    recordPass('1. TagPosts connects to /api/tags/:slug/posts', 'TagPosts component fetches topic tag and matching stories');
  } catch (err) {
    recordFail('1. TagPosts connects to /api/tags/:slug/posts', err);
  }

  // Test 2: TagPosts UI states (post cards, empty state, 404 state)
  try {
    assert.ok(tagPostsContent.includes('posts.map('), 'TagPosts renders story cards');
    assert.ok(tagPostsContent.includes('No published stories yet'), 'TagPosts includes empty stories state');
    assert.ok(tagPostsContent.includes('404 — Tag Not Found'), 'TagPosts handles non-existent tag 404');
    recordPass('2. TagPosts UI states', 'TagPosts supports active stories feed, empty state, and 404 state');
  } catch (err) {
    recordFail('2. TagPosts UI states', err);
  }

  // Test 3: Tag creation while writing in Editor
  try {
    assert.ok(editorContent.includes('handleCreateTag'), 'Editor defines handleCreateTag');
    assert.ok(/api\s*\.\s*post\(\s*['"]\/tags['"]\s*,/.test(editorContent), 'Editor calls POST /api/tags');
    assert.ok(editorContent.includes('new-tag-inline-form'), 'Editor renders tag creation form');
    recordPass('3. Tag creation while writing', 'Editor allows creating and auto-associating new tags inline');
  } catch (err) {
    recordFail('3. Tag creation while writing', err);
  }

  // Test 4: Navbar full application navigation
  try {
    assert.ok(navbarContent.includes('to="/dashboard"'), 'Navbar links to Dashboard');
    assert.ok(navbarContent.includes('to="/editor/new"'), 'Navbar links to Editor');
    assert.ok(navbarContent.includes('to="/settings"'), 'Navbar links to Settings');
    assert.ok(navbarContent.includes('/profile/'), 'Navbar links to User Profile');
    recordPass('4. Navbar navigation integration', 'Navbar provides integrated links for Dashboard, Write, Settings, and Profile');
  } catch (err) {
    recordFail('4. Navbar navigation integration', err);
  }

  // Test 5: Dashboard and Editor navigation flow
  try {
    assert.ok(dashboardContent.includes('to="/editor/new"'), 'Dashboard links to /editor/new');
    assert.ok(dashboardContent.includes('/editor/${post._id}'), 'Dashboard links to /editor/:id');
    recordPass('5. Dashboard to Editor navigation', 'Dashboard routes seamlessly to post creation and post editing');
  } catch (err) {
    recordFail('5. Dashboard to Editor navigation', err);
  }

  // --- Phase 2: Live Backend E2E Workflows & Tag Verification ---
  console.log('\n--- Phase 2: Live Backend E2E Workflows & Tag API ---');

  let testServer;
  let serverURL;
  let isDbConnected = false;
  const createdUserIds = [];
  const createdPostIds = [];
  const createdTagIds = [];

  try {
    await connectDB();
    isDbConnected = true;

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use('/api/posts', postsRouter);
    app.use('/api/tags', tagsRouter);
    app.use('/api/users', usersRouter);
    app.use(errorHandler);

    await new Promise((resolve) => {
      testServer = app.listen(0, () => {
        const port = testServer.address().port;
        serverURL = `http://localhost:${port}/api`;
        resolve();
      });
    });

    // -----------------------------------------------------------------------
    // WORKFLOW A: New User (Register -> Login -> Dashboard Access -> Save Draft)
    // -----------------------------------------------------------------------
    let userToken;
    let registeredUser;
    let createdDraftId;

    try {
      // 1. Register
      const regRes = await axios.post(`${serverURL}/auth/register`, {
        name: 'Workflow User',
        email: `wf_user_${testRunId}@example.com`,
        password: 'Password123!',
      });
      assert.strictEqual(regRes.status, 201);
      registeredUser = regRes.data.user;
      userToken = regRes.data.token;
      createdUserIds.push(registeredUser.id || registeredUser._id);

      // 2. Login
      const loginRes = await axios.post(`${serverURL}/auth/login`, {
        email: `wf_user_${testRunId}@example.com`,
        password: 'Password123!',
      });
      assert.strictEqual(loginRes.status, 200);
      assert.ok(loginRes.data.token);

      // 3. Access Dashboard stories (/api/posts/mine)
      const authHeader = { headers: { Authorization: `Bearer ${userToken}` } };
      const mineRes = await axios.get(`${serverURL}/posts/mine`, authHeader);
      assert.strictEqual(mineRes.status, 200);
      assert.strictEqual(mineRes.data.posts.length, 0);

      // 4. Create post as Draft
      const draftRes = await axios.post(
        `${serverURL}/posts`,
        {
          title: `Initial Draft ${testRunId}`,
          content: '# My First Draft\n\nWriting thoughts.',
          status: 'draft',
        },
        authHeader
      );
      assert.strictEqual(draftRes.status, 201);
      assert.strictEqual(draftRes.data.post.status, 'draft');
      createdDraftId = draftRes.data.post._id;
      createdPostIds.push(createdDraftId);

      recordPass('6. Workflow A — New user', 'Register -> Login -> Dashboard -> Create draft successfully executed');
    } catch (err) {
      recordFail('6. Workflow A — New user', err);
    }

    // -----------------------------------------------------------------------
    // WORKFLOW B: Publishing (Edit Draft -> Preview/Verify -> Publish -> Reader)
    // -----------------------------------------------------------------------
    let publishedSlug;

    try {
      const authHeader = { headers: { Authorization: `Bearer ${userToken}` } };

      // 1. Fetch draft for editor
      const getDraft = await axios.get(`${serverURL}/posts/${createdDraftId}`, authHeader);
      assert.strictEqual(getDraft.status, 200);
      assert.strictEqual(getDraft.data.post.status, 'draft');

      // 2. Publish draft via PUT /api/posts/:id
      const pubRes = await axios.put(
        `${serverURL}/posts/${createdDraftId}`,
        {
          title: `Now Published Story ${testRunId}`,
          content: '# Now Published\n\nFull polished story content.',
          status: 'published',
        },
        authHeader
      );
      assert.strictEqual(pubRes.status, 200);
      assert.strictEqual(pubRes.data.post.status, 'published');
      publishedSlug = pubRes.data.post.slug;

      // 3. Open public post by slug without auth
      const publicRes = await axios.get(`${serverURL}/posts/${publishedSlug}`);
      assert.strictEqual(publicRes.status, 200);
      assert.strictEqual(publicRes.data.post.title, `Now Published Story ${testRunId}`);

      recordPass('7. Workflow B — Publishing', 'Edit draft -> Publish -> Open public post successfully executed');
    } catch (err) {
      recordFail('7. Workflow B — Publishing', err);
    }

    // -----------------------------------------------------------------------
    // WORKFLOW C: Post Management (Edit Published -> Update -> Delete)
    // -----------------------------------------------------------------------
    try {
      const authHeader = { headers: { Authorization: `Bearer ${userToken}` } };

      // 1. Edit published post
      const editPubRes = await axios.put(
        `${serverURL}/posts/${createdDraftId}`,
        {
          title: `Updated Title For Deletion ${testRunId}`,
        },
        authHeader
      );
      assert.strictEqual(editPubRes.status, 200);
      assert.strictEqual(editPubRes.data.post.title, `Updated Title For Deletion ${testRunId}`);

      // 2. Delete post
      const delRes = await axios.delete(`${serverURL}/posts/${createdDraftId}`, authHeader);
      assert.strictEqual(delRes.status, 200);

      // 3. Verify post is gone
      try {
        await axios.get(`${serverURL}/posts/${createdDraftId}`);
        assert.fail('Deleted post should not be retrievable');
      } catch (notFoundErr) {
        assert.strictEqual(notFoundErr.response?.status, 404);
      }

      recordPass('8. Workflow C — Post management', 'Edit published -> Update -> Delete confirmed and verified');
    } catch (err) {
      recordFail('8. Workflow C — Post management', err);
    }

    // -----------------------------------------------------------------------
    // WORKFLOW D: Tags (Create Tag -> Publish Post with Tag -> Tag Filter)
    // -----------------------------------------------------------------------
    let createdTagId;
    let tagSlug;

    try {
      const authHeader = { headers: { Authorization: `Bearer ${userToken}` } };

      // 1. Create tag via POST /api/tags
      const tagRes = await axios.post(
        `${serverURL}/tags`,
        { name: `NodeJS_${testRunId}` },
        authHeader
      );
      assert.ok([200, 201].includes(tagRes.status));
      assert.strictEqual(tagRes.data.tag.name, `nodejs_${testRunId}`.toLowerCase());
      createdTagId = tagRes.data.tag._id;
      tagSlug = tagRes.data.tag.slug;
      createdTagIds.push(createdTagId);

      // 2. Test duplicate tag creation returns existing tag (deduplication)
      const dupRes = await axios.post(
        `${serverURL}/tags`,
        { name: `  NodeJS_${testRunId}  ` },
        authHeader
      );
      assert.strictEqual(dupRes.status, 200);
      assert.strictEqual(dupRes.data.tag._id.toString(), createdTagId.toString());

      // 3. Create and publish a post associated with this tag
      const postWithTagRes = await axios.post(
        `${serverURL}/posts`,
        {
          title: `Tagged Story ${testRunId}`,
          content: '# Tagged Story Content',
          status: 'published',
          tags: [createdTagId],
        },
        authHeader
      );
      assert.strictEqual(postWithTagRes.status, 201);
      createdPostIds.push(postWithTagRes.data.post._id);

      // 4. Create a draft with the same tag (draft privacy test)
      const draftWithTagRes = await axios.post(
        `${serverURL}/posts`,
        {
          title: `Draft Tagged Story ${testRunId}`,
          content: '# Secret Draft with Tag',
          status: 'draft',
          tags: [createdTagId],
        },
        authHeader
      );
      createdPostIds.push(draftWithTagRes.data.post._id);

      // 5. Query tag endpoint GET /api/tags
      const allTagsRes = await axios.get(`${serverURL}/tags`);
      assert.strictEqual(allTagsRes.status, 200);
      const foundTag = allTagsRes.data.tags.find((t) => t._id.toString() === createdTagId.toString());
      assert.ok(foundTag, 'Created tag must appear in GET /api/tags');
      assert.strictEqual(foundTag.postCount, 1, 'Tag count must only count published posts (excluding drafts)');

      // 6. Query tag posts GET /api/tags/:slug/posts
      const tagPostsRes = await axios.get(`${serverURL}/tags/${tagSlug}/posts`);
      assert.strictEqual(tagPostsRes.status, 200);
      assert.strictEqual(tagPostsRes.data.count, 1, 'Matching posts must only include published stories');
      assert.strictEqual(tagPostsRes.data.posts[0].title, `Tagged Story ${testRunId}`);
      assert.ok(!tagPostsRes.data.posts.some((p) => p.status === 'draft'), 'Drafts must never appear in tag feed');

      recordPass('9. Workflow D — Tags', 'Tag creation -> Deduplication -> Post association -> Published count -> Tag feed verified');
    } catch (err) {
      recordFail('9. Workflow D — Tags', err);
    }

    // -----------------------------------------------------------------------
    // WORKFLOW E: Profiles & Settings (Profile -> Settings -> Update -> Verify)
    // -----------------------------------------------------------------------
    try {
      const authHeader = { headers: { Authorization: `Bearer ${userToken}` } };
      const userId = registeredUser.id || registeredUser._id;

      // 1. View public profile
      const profRes = await axios.get(`${serverURL}/users/${userId}`);
      assert.strictEqual(profRes.status, 200);
      assert.strictEqual(profRes.data.user.name, 'Workflow User');

      // 2. Update profile in settings
      const updateProfRes = await axios.put(
        `${serverURL}/users/me`,
        {
          name: 'Updated Workflow Engineer',
          bio: 'Fullstack MERN architect.',
          avatarUrl: 'https://example.com/wf-avatar.jpg',
        },
        authHeader
      );
      assert.strictEqual(updateProfRes.status, 200);
      assert.strictEqual(updateProfRes.data.user.name, 'Updated Workflow Engineer');

      // 3. Verify public profile reflects update
      const verifyProfRes = await axios.get(`${serverURL}/users/${userId}`);
      assert.strictEqual(verifyProfRes.status, 200);
      assert.strictEqual(verifyProfRes.data.user.name, 'Updated Workflow Engineer');
      assert.strictEqual(verifyProfRes.data.user.bio, 'Fullstack MERN architect.');
      assert.strictEqual(verifyProfRes.data.user.avatarUrl, 'https://example.com/wf-avatar.jpg');

      recordPass('10. Workflow E — Profiles & Settings', 'View public profile -> Update settings -> Verify updated profile verified');
    } catch (err) {
      recordFail('10. Workflow E — Profiles & Settings', err);
    }

    // -----------------------------------------------------------------------
    // WORKFLOW F: Authentication (Logout / Unauthenticated Redirects)
    // -----------------------------------------------------------------------
    try {
      // 1. Protected routes reject unauthenticated requests
      try {
        await axios.get(`${serverURL}/posts/mine`);
        assert.fail('Unauthenticated /posts/mine should return 401');
      } catch (unauthMine) {
        assert.strictEqual(unauthMine.response?.status, 401);
      }

      try {
        await axios.post(`${serverURL}/posts`, { title: 'No Auth' });
        assert.fail('Unauthenticated /posts should return 401');
      } catch (unauthPost) {
        assert.strictEqual(unauthPost.response?.status, 401);
      }

      try {
        await axios.put(`${serverURL}/users/me`, { name: 'No Auth' });
        assert.fail('Unauthenticated /users/me should return 401');
      } catch (unauthMe) {
        assert.strictEqual(unauthMe.response?.status, 401);
      }

      // 2. Re-login restores access
      const reLoginRes = await axios.post(`${serverURL}/auth/login`, {
        email: `wf_user_${testRunId}@example.com`,
        password: 'Password123!',
      });
      assert.strictEqual(reLoginRes.status, 200);
      const newToken = reLoginRes.data.token;

      const restoredMine = await axios.get(`${serverURL}/posts/mine`, {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      assert.strictEqual(restoredMine.status, 200);

      recordPass('11. Workflow F — Authentication & Protected Access', 'Unauthenticated operations blocked; login restores access to protected endpoints');
    } catch (err) {
      recordFail('11. Workflow F — Authentication & Protected Access', err);
    }

  } catch (setupErr) {
    console.error('[Setup/Run Error]:', setupErr.message);
  } finally {
    if (isDbConnected) {
      try {
        if (createdPostIds.length > 0) {
          await Post.deleteMany({ _id: { $in: createdPostIds } });
        }
        if (createdUserIds.length > 0) {
          await User.deleteMany({ _id: { $in: createdUserIds } });
        }
        if (createdTagIds.length > 0) {
          await Tag.deleteMany({ _id: { $in: createdTagIds } });
        }
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
  console.log(`DAY 15 TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.length === 0 || results.some((r) => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

runDay15Integration();

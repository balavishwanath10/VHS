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
import postsRouter from '../routes/posts.js';
import errorHandler from '../middleware/errorHandler.js';
import { validateEnv } from '../config/validateEnv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const results = [];
const testRunId = `d13_${Date.now()}`;

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runDay13Verification() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 13 Post Editing & Deletion Verification (${testRunId})`);
  console.log(`==================================================\n`);

  // Part 1: Static / Component Code Analysis
  console.log('--- Phase 1: Frontend Editor & Dashboard Verification ---');

  const editorContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Editor.jsx'), 'utf8');
  const dashboardContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Dashboard.jsx'), 'utf8');

  // Test 1: Editor fetches post by ID in edit mode
  try {
    assert.ok(editorContent.includes("Boolean(id && id !== 'new')"), 'Editor must detect edit mode');
    assert.ok(/api\s*\.\s*get\(\s*`\/posts\/\$\{id\}`\s*\)/.test(editorContent), 'Editor must fetch post by ID');
    recordPass('1. Editor fetches existing post by ID', 'Editor detects edit mode and requests post by ID');
  } catch (err) {
    recordFail('1. Editor fetches existing post by ID', err);
  }

  // Test 2: Editor populates all fields
  try {
    assert.ok(editorContent.includes('setTitle(post.title ||'), 'Editor populates title');
    assert.ok(editorContent.includes('setContent(post.content ||'), 'Editor populates content');
    assert.ok(editorContent.includes('setCoverImage(post.coverImage ||'), 'Editor populates coverImage');
    assert.ok(editorContent.includes('setPostStatus(post.status ||'), 'Editor populates postStatus');
    assert.ok(editorContent.includes('setSelectedTags('), 'Editor populates selected tags');
    recordPass('2. Editor field population', 'Title, content, cover image, status, and tags populated from existing post');
  } catch (err) {
    recordFail('2. Editor field population', err);
  }

  // Test 3: Editor updates via PUT /api/posts/:id
  try {
    assert.ok(
      /api\s*\.\s*put\(\s*`\/posts\/\$\{id\}`\s*,\s*payload\s*\)/.test(editorContent),
      'Editor must submit updates via PUT /api/posts/:id'
    );
    recordPass('3. Editor persists updates via PUT', 'Updates routed to PUT /api/posts/:id');
  } catch (err) {
    recordFail('3. Editor persists updates via PUT', err);
  }

  // Test 4: Dashboard edit button links to /editor/:id
  try {
    assert.ok(dashboardContent.includes('to={`/editor/${post._id}`}'), 'Dashboard edit links to /editor/:id');
    recordPass('4. Dashboard edit button routing', 'Edit button links directly to editor with post ID');
  } catch (err) {
    recordFail('4. Dashboard edit button routing', err);
  }

  // Test 5: Dashboard delete confirmation and optimistic state update
  try {
    assert.ok(dashboardContent.includes('window.confirm'), 'Dashboard prompts user confirmation');
    assert.ok(/api\s*\.\s*delete\(\s*`\/posts\/\$\{postId\}`\s*\)/.test(dashboardContent), 'Dashboard calls DELETE /api/posts/:id');
    assert.ok(dashboardContent.includes('prev.filter((p) => p._id !== postId)'), 'Dashboard removes deleted post from state');
    recordPass('5. Dashboard delete confirmation and state update', 'Confirmation dialog guards delete; post removed without page refresh');
  } catch (err) {
    recordFail('5. Dashboard delete confirmation and state update', err);
  }

  // Part 2: Backend Live Security & API Verification
  console.log('\n--- Phase 2: Live Backend Security & API Verification ---');

  let testServer;
  let baseURL;
  let userA, userB;
  let tokenA, tokenB;
  let tag;
  const createdPostIds = [];
  let isDbConnected = false;

  try {
    await connectDB();
    isDbConnected = true;

    const { secret } = validateEnv();

    userA = await User.create({
      name: 'Day 13 Author A',
      email: `author_a_${testRunId}@example.com`,
      password: 'Password123!',
      bio: 'Author A Bio',
    });

    userB = await User.create({
      name: 'Day 13 User B',
      email: `user_b_${testRunId}@example.com`,
      password: 'Password123!',
      bio: 'User B Bio',
    });

    tokenA = jwt.sign({ id: userA._id.toString() }, secret, { expiresIn: '1h' });
    tokenB = jwt.sign({ id: userB._id.toString() }, secret, { expiresIn: '1h' });

    tag = await Tag.create({ name: `tag_${testRunId}`, slug: `tag-${testRunId}` });

    const app = express();
    app.use(express.json());
    app.use('/api/posts', postsRouter);
    app.use(errorHandler);

    await new Promise((resolve) => {
      testServer = app.listen(0, () => {
        const port = testServer.address().port;
        baseURL = `http://localhost:${port}/api/posts`;
        resolve();
      });
    });

    const headersA = { headers: { Authorization: `Bearer ${tokenA}` } };
    const headersB = { headers: { Authorization: `Bearer ${tokenB}` } };

    // Create a draft post by User A
    const draftRes = await axios.post(
      baseURL,
      {
        title: `Draft Post ${testRunId}`,
        content: '# Draft Content\n\nInitial draft content.',
        status: 'draft',
        coverImage: 'https://example.com/draft-cover.jpg',
        tags: [tag._id.toString()],
      },
      headersA
    );
    const draftPost = draftRes.data.post;
    createdPostIds.push(draftPost._id);

    // Create a published post by User A
    const pubRes = await axios.post(
      baseURL,
      {
        title: `Published Post ${testRunId}`,
        content: '# Published Content\n\nInitial published content.',
        status: 'published',
        coverImage: 'https://example.com/pub-cover.jpg',
        tags: [tag._id.toString()],
      },
      headersA
    );
    const publishedPost = pubRes.data.post;
    createdPostIds.push(publishedPost._id);

    // Test 6: Author retrieves own draft by ID
    try {
      const getDraftRes = await axios.get(`${baseURL}/${draftPost._id}`, headersA);
      assert.strictEqual(getDraftRes.status, 200);
      assert.strictEqual(getDraftRes.data.post.title, draftPost.title);
      assert.strictEqual(getDraftRes.data.post.status, 'draft');
      recordPass('6. Author can retrieve own draft by ID', 'Author successfully fetches draft post using ID');
    } catch (err) {
      recordFail('6. Author can retrieve own draft by ID', err);
    }

    // Test 7: Unauthenticated user cannot retrieve draft
    try {
      await axios.get(`${baseURL}/${draftPost._id}`);
      recordFail('7. Draft privacy against unauthenticated access', new Error('Unauthenticated user was allowed to retrieve draft'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 404, 'Draft must return 404 for unauthenticated visitor');
      recordPass('7. Draft privacy against unauthenticated access', 'Unauthenticated request for draft returns 404 Not Found');
    }

    // Test 8: Non-owner cannot retrieve another user\'s draft
    try {
      await axios.get(`${baseURL}/${draftPost._id}`, headersB);
      recordFail('8. Draft privacy against non-owner access', new Error('Non-owner was allowed to retrieve draft'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 404, 'Draft must return 404 for non-owner');
      recordPass('8. Draft privacy against non-owner access', 'Non-owner request for draft returns 404 Not Found');
    }

    // Test 9: Public can retrieve published post by ID or slug
    try {
      const getPubById = await axios.get(`${baseURL}/${publishedPost._id}`);
      assert.strictEqual(getPubById.status, 200);
      assert.strictEqual(getPubById.data.post.title, publishedPost.title);

      const getPubBySlug = await axios.get(`${baseURL}/${publishedPost.slug}`);
      assert.strictEqual(getPubBySlug.status, 200);
      assert.strictEqual(getPubBySlug.data.post._id.toString(), publishedPost._id.toString());
      recordPass('9. Published posts accessible by ID and slug', 'Published post successfully retrieved by both ID and slug');
    } catch (err) {
      recordFail('9. Published posts accessible by ID and slug', err);
    }

    // Test 10: Author can update their own post
    try {
      const updateRes = await axios.put(
        `${baseURL}/${draftPost._id}`,
        {
          title: `Updated Draft Title ${testRunId}`,
          content: '## Updated Content\n\nModified markdown text.',
          coverImage: 'https://example.com/updated-cover.jpg',
          status: 'published',
        },
        headersA
      );
      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.data.post.title, `Updated Draft Title ${testRunId}`);
      assert.strictEqual(updateRes.data.post.status, 'published');
      assert.strictEqual(updateRes.data.post.coverImage, 'https://example.com/updated-cover.jpg');
      recordPass('10. Author can update own post (fields and status)', 'Author updates title, content, coverImage, and transitions draft to published');
    } catch (err) {
      recordFail('10. Author can update own post (fields and status)', err);
    }

    // Test 11: Non-owner cannot update someone else\'s post
    try {
      await axios.put(
        `${baseURL}/${draftPost._id}`,
        {
          title: 'Hacked Title by User B',
        },
        headersB
      );
      recordFail('11. Non-owner update blocked', new Error('Non-owner was able to update post'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Must return 403 Forbidden for non-owner update');
      assert.ok(err.response.data.error.message.includes('Not authorized'));
      recordPass('11. Non-owner update blocked', 'Server returns 403 Forbidden on attempted unauthorized edit');
    }

    // Test 12: Unauthenticated update blocked
    try {
      await axios.put(`${baseURL}/${draftPost._id}`, {
        title: 'Unauthenticated Title Change',
      });
      recordFail('12. Unauthenticated update blocked', new Error('Unauthenticated user was able to update post'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Must return 401 for unauthenticated update');
      recordPass('12. Unauthenticated update blocked', 'Server returns 401 Unauthorized when token missing');
    }

    // Test 13: Non-owner cannot delete someone else\'s post
    try {
      await axios.delete(`${baseURL}/${draftPost._id}`, headersB);
      recordFail('13. Non-owner deletion blocked', new Error('Non-owner was able to delete post'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 403, 'Must return 403 Forbidden for non-owner deletion');
      recordPass('13. Non-owner deletion blocked', 'Server returns 403 Forbidden on attempted unauthorized delete');
    }

    // Test 14: Unauthenticated deletion blocked
    try {
      await axios.delete(`${baseURL}/${draftPost._id}`);
      recordFail('14. Unauthenticated deletion blocked', new Error('Unauthenticated user was able to delete post'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Must return 401 for unauthenticated delete');
      recordPass('14. Unauthenticated deletion blocked', 'Server returns 401 Unauthorized when token missing');
    }

    // Test 15: Author can delete own post
    try {
      const delRes = await axios.delete(`${baseURL}/${draftPost._id}`, headersA);
      assert.strictEqual(delRes.status, 200);
      assert.strictEqual(delRes.data.message, 'Post deleted successfully');
      recordPass('15. Author can delete own post', 'Author successfully deletes post with 200 response');
    } catch (err) {
      recordFail('15. Author can delete own post', err);
    }

    // Test 16: Deleted post cannot subsequently be retrieved
    try {
      await axios.get(`${baseURL}/${draftPost._id}`, headersA);
      recordFail('16. Deleted post retrieval blocked', new Error('Deleted post was retrieved'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 404, 'Must return 404 for deleted post');
      recordPass('16. Deleted post retrieval blocked', 'Deleted post returns 404 Not Found on subsequent requests');
    }

    // Test 17: Invalid post IDs return appropriate 400 error
    try {
      await axios.put(`${baseURL}/invalid-mongo-id`, { title: 'New' }, headersA);
      recordFail('17. Invalid ID format rejected', new Error('Invalid ID did not return 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      recordPass('17. Invalid ID format rejected', 'PUT with malformed ObjectId returns 400 error');
    }

  } catch (setupErr) {
    console.error('[Setup/Run Error]:', setupErr.message);
  } finally {
    // Cleanup created test resources
    if (isDbConnected) {
      try {
        if (createdPostIds.length > 0) {
          await Post.deleteMany({ _id: { $in: createdPostIds } });
        }
        if (userA) await User.deleteOne({ _id: userA._id });
        if (userB) await User.deleteOne({ _id: userB._id });
        if (tag) await Tag.deleteOne({ _id: tag._id });
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
  console.log(`DAY 13 TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.length === 0 || results.some((r) => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

runDay13Verification();

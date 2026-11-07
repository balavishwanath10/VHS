import 'dotenv/config';
import assert from 'node:assert';
import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Tag from '../models/Tag.js';
import postsRouter from '../routes/posts.js';
import tagsRouter from '../routes/tags.js';
import errorHandler from '../middleware/errorHandler.js';
import { validateEnv } from '../config/validateEnv.js';

const results = [];
const testRunId = `d8_${Date.now()}`;

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runDay8Tests() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 8 Tags, Counts, Filtering & Search (${testRunId})`);
  console.log(`==================================================\n`);

  let testServer;
  let baseURL;
  let user;
  let token;
  let tagJs, tagReact, tagEmpty;
  const createdPostIds = [];

  try {
    // Connect to database
    await connectDB();
    console.log('[Setup] Connected to MongoDB Atlas.\n');

    // Create test user
    user = await User.create({
      name: 'Day 8 Search Author',
      email: `search_author_${testRunId}@example.com`,
      password: 'Password123!',
      bio: 'Author Bio for Search',
    });

    const { secret } = validateEnv();
    token = jwt.sign({ id: user._id }, secret, { expiresIn: '1h' });

    // Create test tags
    tagJs = await Tag.create({ name: `js_${testRunId}`, slug: `js-${testRunId}` });
    tagReact = await Tag.create({ name: `react_${testRunId}`, slug: `react-${testRunId}` });
    tagEmpty = await Tag.create({ name: `empty_${testRunId}`, slug: `empty-${testRunId}` });

    // Setup Express test server
    const app = express();
    app.use(express.json());
    app.use('/api/posts', postsRouter);
    app.use('/api/tags', tagsRouter);
    app.use(errorHandler);

    await new Promise((resolve) => {
      testServer = app.listen(0, () => {
        const port = testServer.address().port;
        baseURL = `http://localhost:${port}`;
        console.log(`[Setup] Day 8 test server listening on port ${port}.\n`);
        resolve();
      });
    });

    const headers = { headers: { Authorization: `Bearer ${token}` } };

    // Seed test posts:
    // 1. Published Post 1: Title matches "Quantum", content has "Physics", tagged [tagJs]
    const p1Res = await axios.post(
      `${baseURL}/api/posts`,
      {
        title: `Quantum Algorithms in Node ${testRunId}`,
        content: 'Exploration of computational physics and matrix math.',
        status: 'published',
        tags: [tagJs._id],
      },
      headers
    );
    const post1 = p1Res.data.post;
    createdPostIds.push(post1._id);

    // Delay slightly to ensure distinct createdAt timestamps
    await new Promise((r) => setTimeout(r, 100));

    // 2. Published Post 2: Title has "Architecture", content matches "Quantum", tagged [tagJs, tagReact]
    const p2Res = await axios.post(
      `${baseURL}/api/posts`,
      {
        title: `Modern Frontend Architecture ${testRunId}`,
        content: 'Discussing quantum leap improvements in virtual DOM rendering.',
        status: 'published',
        tags: [tagJs._id, tagReact._id],
      },
      headers
    );
    const post2 = p2Res.data.post;
    createdPostIds.push(post2._id);

    // 3. Draft Post 3: Title matches "Quantum", tagged [tagJs] - DRAFT
    const p3Res = await axios.post(
      `${baseURL}/api/posts`,
      {
        title: `Quantum Draft Secret ${testRunId}`,
        content: 'Secret unpublished quantum notes.',
        status: 'draft',
        tags: [tagJs._id],
      },
      headers
    );
    const post3 = p3Res.data.post;
    createdPostIds.push(post3._id);

    // -------------------------------------------------------------------------
    // TEST 1: Tags endpoint returns existing tags
    // -------------------------------------------------------------------------
    try {
      const tagsRes = await axios.get(`${baseURL}/api/tags`);
      assert.strictEqual(tagsRes.status, 200);
      assert.ok(Array.isArray(tagsRes.data.tags));
      const slugs = tagsRes.data.tags.map((t) => t.slug);
      assert.ok(slugs.includes(tagJs.slug));
      assert.ok(slugs.includes(tagReact.slug));
      assert.ok(slugs.includes(tagEmpty.slug));
      recordPass('1. Tags endpoint returns existing tags', 'All registered tags retrieved via GET /api/tags');
    } catch (err) {
      recordFail('1. Tags endpoint returns existing tags', err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Tag counts are correct (reflects published posts)
    // -------------------------------------------------------------------------
    try {
      const tagsRes = await axios.get(`${baseURL}/api/tags`);
      const jsTagData = tagsRes.data.tags.find((t) => t._id === tagJs._id.toString());
      const reactTagData = tagsRes.data.tags.find((t) => t._id === tagReact._id.toString());
      const emptyTagData = tagsRes.data.tags.find((t) => t._id === tagEmpty._id.toString());

      // tagJs is in post1 (published) and post2 (published) -> count = 2
      assert.strictEqual(jsTagData.postCount, 2, `tagJs postCount must be 2, was ${jsTagData.postCount}`);
      // tagReact is in post2 (published) -> count = 1
      assert.strictEqual(reactTagData.postCount, 1, `tagReact postCount must be 1, was ${reactTagData.postCount}`);
      // tagEmpty has no posts -> count = 0
      assert.strictEqual(emptyTagData.postCount, 0, `tagEmpty postCount must be 0, was ${emptyTagData.postCount}`);

      recordPass('2. Tag counts are correct', 'Accurate published post counts reported for each tag');
    } catch (err) {
      recordFail('2. Tag counts are correct', err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Draft posts are excluded from tag counts
    // -------------------------------------------------------------------------
    try {
      // post3 is a draft tagged with tagJs. If drafts counted, jsTag count would be 3.
      const tagsRes = await axios.get(`${baseURL}/api/tags`);
      const jsTagData = tagsRes.data.tags.find((t) => t._id === tagJs._id.toString());
      assert.strictEqual(jsTagData.postCount, 2, 'Draft post3 must NOT increment tagJs count');
      recordPass('3. Draft posts are excluded from tag counts', 'Draft posts strictly excluded from postCount');
    } catch (err) {
      recordFail('3. Draft posts are excluded from tag counts', err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Tag-filtered feed returns matching posts
    // -------------------------------------------------------------------------
    try {
      const tagFeedRes = await axios.get(`${baseURL}/api/tags/${tagReact.slug}/posts`);
      assert.strictEqual(tagFeedRes.status, 200);
      assert.strictEqual(tagFeedRes.data.tag.slug, tagReact.slug);
      assert.strictEqual(tagFeedRes.data.posts.length, 1);
      assert.strictEqual(tagFeedRes.data.posts[0]._id, post2._id);
      assert.strictEqual(tagFeedRes.data.posts[0].author.name, user.name);
      recordPass('4. Tag-filtered feed returns matching posts', 'Posts associated with tag returned with populated data');
    } catch (err) {
      recordFail('4. Tag-filtered feed returns matching posts', err);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Draft posts are excluded from tag-filtered feed
    // -------------------------------------------------------------------------
    try {
      const tagFeedRes = await axios.get(`${baseURL}/api/tags/${tagJs.slug}/posts`);
      const returnedIds = tagFeedRes.data.posts.map((p) => p._id);
      assert.ok(returnedIds.includes(post1._id), 'Post 1 must be present');
      assert.ok(returnedIds.includes(post2._id), 'Post 2 must be present');
      assert.strictEqual(returnedIds.includes(post3._id), false, 'Draft post3 must NOT appear in tag feed');
      recordPass('5. Draft posts are excluded from tag-filtered feed', 'Drafts completely absent from GET /api/tags/:slug/posts');
    } catch (err) {
      recordFail('5. Draft posts are excluded from tag-filtered feed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Unknown tag returns expected response (HTTP 404)
    // -------------------------------------------------------------------------
    try {
      await axios.get(`${baseURL}/api/tags/non-existent-tag-slug-xyz/posts`);
      recordFail('6. Unknown tag returns expected response', new Error('Should have returned 404'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 404);
      assert.strictEqual(err.response?.data?.error?.message, 'Tag not found');
      recordPass('6. Unknown tag returns expected response', 'HTTP 404 returned for unknown tag slug');
    }

    // -------------------------------------------------------------------------
    // TEST 7: Tag results are newest first
    // -------------------------------------------------------------------------
    try {
      const tagFeedRes = await axios.get(`${baseURL}/api/tags/${tagJs.slug}/posts`);
      assert.strictEqual(tagFeedRes.data.posts[0]._id, post2._id, 'Post 2 (newer) must be before Post 1 (older)');
      assert.strictEqual(tagFeedRes.data.posts[1]._id, post1._id);
      recordPass('7. Tag results are newest first', 'Tag posts sorted descending by createdAt');
    } catch (err) {
      recordFail('7. Tag results are newest first', err);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Search matches post titles
    // -------------------------------------------------------------------------
    try {
      const searchRes = await axios.get(`${baseURL}/api/posts?search=Quantum Algorithms`);
      assert.strictEqual(searchRes.status, 200);
      const postIds = searchRes.data.posts.map((p) => p._id);
      assert.ok(postIds.includes(post1._id), 'Post 1 title matches "Quantum Algorithms"');
      recordPass('8. Search matches post titles', 'Keyword search successfully matched post title');
    } catch (err) {
      recordFail('8. Search matches post titles', err);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Search matches post content
    // -------------------------------------------------------------------------
    try {
      const searchRes = await axios.get(`${baseURL}/api/posts?search=matrix math`);
      assert.strictEqual(searchRes.status, 200);
      const postIds = searchRes.data.posts.map((p) => p._id);
      assert.ok(postIds.includes(post1._id), 'Post 1 content contains "matrix math"');
      recordPass('9. Search matches post content', 'Keyword search successfully matched Markdown body content');
    } catch (err) {
      recordFail('9. Search matches post content', err);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Search excludes drafts
    // -------------------------------------------------------------------------
    try {
      const searchRes = await axios.get(`${baseURL}/api/posts?search=Quantum`);
      const postIds = searchRes.data.posts.map((p) => p._id);
      // Both post1 and post2 match "Quantum" (in title and content respectively)
      assert.ok(postIds.includes(post1._id));
      assert.ok(postIds.includes(post2._id));
      // Post 3 also matches "Quantum", BUT is a draft
      assert.strictEqual(postIds.includes(post3._id), false, 'Draft post3 must NEVER appear in search results');
      recordPass('10. Search excludes drafts', 'Draft posts with matching search terms excluded');
    } catch (err) {
      recordFail('10. Search excludes drafts', err);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Search with no matches returns empty result
    // -------------------------------------------------------------------------
    try {
      const searchRes = await axios.get(`${baseURL}/api/posts?search=supercalifragilistic12345`);
      assert.strictEqual(searchRes.status, 200);
      assert.strictEqual(searchRes.data.count, 0);
      assert.deepStrictEqual(searchRes.data.posts, []);
      recordPass('11. Search with no matches returns empty result', 'HTTP 200 with count 0 and empty array returned');
    } catch (err) {
      recordFail('11. Search with no matches returns empty result', err);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Empty search behaves like normal feed
    // -------------------------------------------------------------------------
    try {
      const emptySearchRes = await axios.get(`${baseURL}/api/posts?search=   `);
      const normalFeedRes = await axios.get(`${baseURL}/api/posts`);
      assert.strictEqual(emptySearchRes.status, 200);
      assert.strictEqual(emptySearchRes.data.count, normalFeedRes.data.count);
      recordPass('12. Empty search behaves like normal feed', 'Whitespace-only search returns full published feed');
    } catch (err) {
      recordFail('12. Empty search behaves like normal feed', err);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Search combined with tag filtering works
    // -------------------------------------------------------------------------
    try {
      // Search for "Quantum" filtered by tagReact
      // Post 1 matches "Quantum" but has only tagJs
      // Post 2 matches "Quantum" and has tagReact!
      const combinedRes = await axios.get(`${baseURL}/api/posts?search=Quantum&tag=${tagReact.slug}`);
      assert.strictEqual(combinedRes.status, 200);
      const postIds = combinedRes.data.posts.map((p) => p._id);
      assert.strictEqual(postIds.includes(post2._id), true, 'Post 2 matches both search and tag');
      assert.strictEqual(postIds.includes(post1._id), false, 'Post 1 does not have tagReact, must be excluded');
      recordPass('13. Search combined with tag filtering works', 'Combined ?search=...&tag=... filters accurately');
    } catch (err) {
      recordFail('13. Search combined with tag filtering works', err);
    }

    // -------------------------------------------------------------------------
    // TEST 14: Invalid query input is handled safely
    // -------------------------------------------------------------------------
    try {
      // Regex special characters in search should not crash
      const regexSafeRes = await axios.get(`${baseURL}/api/posts?search=[a-z]+(?=test)*?$$$`);
      assert.strictEqual(regexSafeRes.status, 200);

      // Nonexistent tag in query returns empty array
      const badTagRes = await axios.get(`${baseURL}/api/posts?tag=non-existent-tag-slug-xyz`);
      assert.strictEqual(badTagRes.status, 200);
      assert.strictEqual(badTagRes.data.count, 0);

      recordPass('14. Invalid query input is handled safely', 'Special regex characters and unknown tag filters handled safely without error');
    } catch (err) {
      recordFail('14. Invalid query input is handled safely', err);
    }

    // -------------------------------------------------------------------------
    // TEST 15: Existing Day 6 and Day 7 tests continue passing
    // -------------------------------------------------------------------------
    try {
      // Fast regression check on /api/posts/mine and single post retrieval
      const mineRes = await axios.get(`${baseURL}/api/posts/mine`, headers);
      assert.strictEqual(mineRes.status, 200);
      assert.ok(mineRes.data.posts.length >= 3);

      const singleRes = await axios.get(`${baseURL}/api/posts/${post1.slug}`);
      assert.strictEqual(singleRes.status, 200);
      assert.strictEqual(singleRes.data.post._id, post1._id);

      recordPass('15. Existing Day 6 and Day 7 tests continue passing', 'Day 6 & 7 routes function correctly alongside Day 8');
    } catch (err) {
      recordFail('15. Existing Day 6 and Day 7 tests continue passing', err);
    }

  } catch (globalErr) {
    console.error('Fatal error in Day 8 tests:', globalErr);
  } finally {
    try {
      if (createdPostIds.length > 0) {
        await Post.deleteMany({ _id: { $in: createdPostIds } });
        console.log(`[Cleanup] Deleted ${createdPostIds.length} test post(s).`);
      }
      if (user) await User.findByIdAndDelete(user._id);
      if (tagJs) await Tag.findByIdAndDelete(tagJs._id);
      if (tagReact) await Tag.findByIdAndDelete(tagReact._id);
      if (tagEmpty) await Tag.findByIdAndDelete(tagEmpty._id);
      console.log('[Cleanup] Test user and tags deleted.');
      await mongoose.disconnect();
      console.log('[Cleanup] Disconnected from MongoDB Atlas.');
    } catch (cleanupErr) {
      console.warn('[Cleanup] Warning during cleanup:', cleanupErr.message);
    }

    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
      console.log('[Cleanup] Day 8 test server closed.');
    }
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log(`\n==================================================`);
  console.log(`DAY 8 TEST SUMMARY: ${passed}/${results.length} PASSED (${failed} FAILED)`);
  console.log(`==================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runDay8Tests();

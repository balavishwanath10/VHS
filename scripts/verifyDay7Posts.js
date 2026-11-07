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
import errorHandler from '../middleware/errorHandler.js';
import { validateEnv } from '../config/validateEnv.js';

const results = [];
const testRunId = `d7_${Date.now()}`;

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runDay7Tests() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 7 Post Retrieval, Update, Delete & Ownership (${testRunId})`);
  console.log(`==================================================\n`);

  let testServer;
  let baseURL;
  let userA, userB;
  let tokenA, tokenB;
  let tag1, tag2;
  const createdPostIds = [];

  try {
    // Connect to database
    await connectDB();
    console.log('[Setup] Connected to MongoDB Atlas.\n');

    // Create test users
    userA = await User.create({
      name: 'Day 7 Author A',
      email: `author_a_${testRunId}@example.com`,
      password: 'Password123!',
      bio: 'Author A Bio',
    });
    userB = await User.create({
      name: 'Day 7 Author B',
      email: `author_b_${testRunId}@example.com`,
      password: 'Password123!',
      bio: 'Author B Bio',
    });

    const { secret } = validateEnv();
    tokenA = jwt.sign({ id: userA._id }, secret, { expiresIn: '1h' });
    tokenB = jwt.sign({ id: userB._id }, secret, { expiresIn: '1h' });

    // Create test tags
    tag1 = await Tag.create({ name: `tag1_${testRunId}`, slug: `tag1-${testRunId}` });
    tag2 = await Tag.create({ name: `tag2_${testRunId}`, slug: `tag2-${testRunId}` });

    // Setup Express test server
    const app = express();
    app.use(express.json());
    app.use('/api/posts', postsRouter);
    app.use(errorHandler);

    await new Promise((resolve) => {
      testServer = app.listen(0, () => {
        const port = testServer.address().port;
        baseURL = `http://localhost:${port}/api/posts`;
        console.log(`[Setup] Day 7 test server listening on port ${port}.\n`);
        resolve();
      });
    });

    const headersA = { headers: { Authorization: `Bearer ${tokenA}` } };
    const headersB = { headers: { Authorization: `Bearer ${tokenB}` } };

    // Create seed posts
    // 1. Published post by User A
    const postA1Res = await axios.post(
      baseURL,
      {
        title: `Post A1 Published ${testRunId}`,
        content: '# Post A1 Content\n\nThis is a published post.',
        status: 'published',
        tags: [tag1._id],
        coverImage: 'https://example.com/cover-a1.jpg',
      },
      headersA
    );
    const postA1 = postA1Res.data.post;
    createdPostIds.push(postA1._id);

    // 2. Draft post by User A
    const postA2Res = await axios.post(
      baseURL,
      {
        title: `Post A2 Draft ${testRunId}`,
        content: '# Post A2 Draft\n\nThis is a private draft.',
        status: 'draft',
      },
      headersA
    );
    const postA2 = postA2Res.data.post;
    createdPostIds.push(postA2._id);

    // 3. Published post by User B (created slightly later to test ordering)
    await new Promise((r) => setTimeout(r, 100));
    const postB1Res = await axios.post(
      baseURL,
      {
        title: `Post B1 Published ${testRunId}`,
        content: '# Post B1 Content\n\nPublished by B.',
        status: 'published',
        tags: [tag2._id],
      },
      headersB
    );
    const postB1 = postB1Res.data.post;
    createdPostIds.push(postB1._id);

    // 4. Draft post by User B
    const postB2Res = await axios.post(
      baseURL,
      {
        title: `Post B2 Draft ${testRunId}`,
        content: '# Post B2 Draft\n\nDraft by B.',
        status: 'draft',
      },
      headersB
    );
    const postB2 = postB2Res.data.post;
    createdPostIds.push(postB2._id);

    // -------------------------------------------------------------------------
    // TEST 1: Public feed returns published posts
    // -------------------------------------------------------------------------
    try {
      const feedRes = await axios.get(baseURL);
      assert.strictEqual(feedRes.status, 200);
      assert.ok(Array.isArray(feedRes.data.posts));
      const postIdsInFeed = feedRes.data.posts.map((p) => p._id);
      assert.ok(postIdsInFeed.includes(postA1._id), 'Post A1 (published) must appear in public feed');
      assert.ok(postIdsInFeed.includes(postB1._id), 'Post B1 (published) must appear in public feed');
      // Author and tags populated
      const foundA1 = feedRes.data.posts.find((p) => p._id === postA1._id);
      assert.strictEqual(foundA1.author.name, userA.name);
      assert.strictEqual(foundA1.tags[0].name, tag1.name);
      recordPass('1. Public feed returns published posts', 'Published posts returned with populated author and tags');
    } catch (err) {
      recordFail('1. Public feed returns published posts', err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Public feed excludes drafts
    // -------------------------------------------------------------------------
    try {
      const feedRes = await axios.get(baseURL);
      const postIdsInFeed = feedRes.data.posts.map((p) => p._id);
      assert.strictEqual(postIdsInFeed.includes(postA2._id), false, 'Draft post A2 must NOT appear in public feed');
      assert.strictEqual(postIdsInFeed.includes(postB2._id), false, 'Draft post B2 must NOT appear in public feed');
      recordPass('2. Public feed excludes drafts', 'No draft posts exposed in GET /api/posts');
    } catch (err) {
      recordFail('2. Public feed excludes drafts', err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Newest-first ordering in public feed
    // -------------------------------------------------------------------------
    try {
      const feedRes = await axios.get(baseURL);
      const testPosts = feedRes.data.posts.filter((p) => p._id === postA1._id || p._id === postB1._id);
      assert.strictEqual(testPosts[0]._id, postB1._id, 'Post B1 (newer) must appear before Post A1 (older)');
      recordPass('3. Newest-first ordering', 'Feed correctly sorted with createdAt descending');
    } catch (err) {
      recordFail('3. Newest-first ordering', err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Retrieve published post by slug
    // -------------------------------------------------------------------------
    try {
      const singleRes = await axios.get(`${baseURL}/${postA1.slug}`);
      assert.strictEqual(singleRes.status, 200);
      assert.strictEqual(singleRes.data.post._id, postA1._id);
      assert.strictEqual(singleRes.data.post.author.name, userA.name);
      assert.strictEqual(singleRes.data.post.tags[0].name, tag1.name);
      recordPass('4. Retrieve published post by slug', 'Published post successfully fetched by slug');
    } catch (err) {
      recordFail('4. Retrieve published post by slug', err);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Missing slug returns 404
    // -------------------------------------------------------------------------
    try {
      await axios.get(`${baseURL}/non-existent-slug-xyz-12345`);
      recordFail('5. Missing slug returns 404', new Error('Should have returned 404'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 404);
      assert.strictEqual(err.response?.data?.error?.message, 'Post not found');
      recordPass('5. Missing slug returns 404', 'HTTP 404 returned for nonexistent slug');
    }

    // -------------------------------------------------------------------------
    // TEST 6: Another user\'s draft is inaccessible
    // -------------------------------------------------------------------------
    try {
      // Unauthenticated request for draft
      let unauthBlocked = false;
      try {
        await axios.get(`${baseURL}/${postA2.slug}`);
      } catch (e) {
        assert.strictEqual(e.response?.status, 404);
        unauthBlocked = true;
      }
      assert.ok(unauthBlocked, 'Unauthenticated visitor must receive 404 for draft post');

      // Another user (User B) request for User A's draft
      let nonOwnerBlocked = false;
      try {
        await axios.get(`${baseURL}/${postA2.slug}`, headersB);
      } catch (e) {
        assert.strictEqual(e.response?.status, 404);
        nonOwnerBlocked = true;
      }
      assert.ok(nonOwnerBlocked, 'Other authenticated user must receive 404 for draft post');

      // Owner (User A) CAN retrieve their own draft
      const ownerRes = await axios.get(`${baseURL}/${postA2.slug}`, headersA);
      assert.strictEqual(ownerRes.status, 200);
      assert.strictEqual(ownerRes.data.post._id, postA2._id);

      recordPass('6. Another user\'s draft is inaccessible', 'Drafts inaccessible to public & other users; accessible only to author');
    } catch (err) {
      recordFail('6. Another user\'s draft is inaccessible', err);
    }

    // -------------------------------------------------------------------------
    // TEST 7: /api/posts/mine requires authentication
    // -------------------------------------------------------------------------
    try {
      await axios.get(`${baseURL}/mine`);
      recordFail('7. /api/posts/mine requires authentication', new Error('Should have returned 401'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401);
      assert.strictEqual(err.response?.data?.error?.message, 'Not authorized, no token provided');
      recordPass('7. /api/posts/mine requires authentication', 'HTTP 401 returned when unauthenticated');
    }

    // -------------------------------------------------------------------------
    // TEST 8: /api/posts/mine returns only current user\'s records
    // -------------------------------------------------------------------------
    try {
      const mineResA = await axios.get(`${baseURL}/mine`, headersA);
      assert.strictEqual(mineResA.status, 200);
      const postIdsA = mineResA.data.posts.map((p) => p._id);
      assert.ok(postIdsA.includes(postA1._id), 'User A must see post A1 (published)');
      assert.ok(postIdsA.includes(postA2._id), 'User A must see post A2 (draft)');
      assert.strictEqual(postIdsA.includes(postB1._id), false, 'User A must NOT see User B posts');
      assert.strictEqual(postIdsA.includes(postB2._id), false, 'User A must NOT see User B drafts');

      const mineResB = await axios.get(`${baseURL}/mine`, headersB);
      const postIdsB = mineResB.data.posts.map((p) => p._id);
      assert.ok(postIdsB.includes(postB1._id));
      assert.ok(postIdsB.includes(postB2._id));
      assert.strictEqual(postIdsB.includes(postA1._id), false);

      recordPass('8. /api/posts/mine returns only current user\'s records', 'User sees all their own published and draft posts and zero others');
    } catch (err) {
      recordFail('8. /api/posts/mine returns only current user\'s records', err);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Owner can update their post
    // -------------------------------------------------------------------------
    try {
      const updateRes = await axios.put(
        `${baseURL}/${postA1._id}`,
        {
          title: `Updated Title A1 ${testRunId}`,
          content: 'Updated content with **markdown** text.',
          status: 'draft',
          coverImage: 'https://example.com/new-cover.png',
        },
        headersA
      );
      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.data.post.title, `Updated Title A1 ${testRunId}`);
      assert.strictEqual(updateRes.data.post.status, 'draft');
      assert.strictEqual(updateRes.data.post.coverImage, 'https://example.com/new-cover.png');
      assert.ok(updateRes.data.post.excerpt.includes('Updated content'));
      recordPass('9. Owner can update their post', 'Post fields successfully updated by owner');
    } catch (err) {
      recordFail('9. Owner can update their post', err);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Non-owner cannot update another user\'s post
    // -------------------------------------------------------------------------
    try {
      await axios.put(
        `${baseURL}/${postA1._id}`,
        {
          title: 'Hacked by User B',
        },
        headersB
      );
      recordFail('10. Non-owner cannot update another user\'s post', new Error('Should have returned 403'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
      assert.strictEqual(err.response?.data?.error?.message, 'Not authorized to update this post');
      recordPass('10. Non-owner cannot update another user\'s post', 'HTTP 403 returned on unauthorized update attempt');
    }

    // -------------------------------------------------------------------------
    // TEST 11: Owner can delete their post
    // -------------------------------------------------------------------------
    try {
      const toDeleteRes = await axios.post(
        baseURL,
        {
          title: `Post To Delete ${testRunId}`,
          content: 'Will be deleted.',
        },
        headersA
      );
      const toDeleteId = toDeleteRes.data.post._id;

      const deleteRes = await axios.delete(`${baseURL}/${toDeleteId}`, headersA);
      assert.strictEqual(deleteRes.status, 200);
      assert.strictEqual(deleteRes.data.message, 'Post deleted successfully');

      // Verify actually removed from database
      const checkInDb = await Post.findById(toDeleteId);
      assert.strictEqual(checkInDb, null, 'Deleted post must no longer exist in DB');

      recordPass('11. Owner can delete their post', 'Post successfully deleted and confirmed removed from DB');
    } catch (err) {
      recordFail('11. Owner can delete their post', err);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Non-owner cannot delete another user\'s post
    // -------------------------------------------------------------------------
    try {
      await axios.delete(`${baseURL}/${postA1._id}`, headersB);
      recordFail('12. Non-owner cannot delete another user\'s post', new Error('Should have returned 403'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
      assert.strictEqual(err.response?.data?.error?.message, 'Not authorized to delete this post');
      // Confirm still exists
      const stillThere = await Post.findById(postA1._id);
      assert.ok(stillThere, 'Post must not be deleted by unauthorized user');
      recordPass('12. Non-owner cannot delete another user\'s post', 'HTTP 403 returned on unauthorized delete attempt');
    }

    // -------------------------------------------------------------------------
    // TEST 13: Invalid post ID handling
    // -------------------------------------------------------------------------
    try {
      let putHandled = false;
      try {
        await axios.put(`${baseURL}/invalid-id-format`, { title: 'New' }, headersA);
      } catch (e) {
        assert.strictEqual(e.response?.status, 400);
        putHandled = true;
      }
      assert.ok(putHandled);

      let deleteHandled = false;
      try {
        await axios.delete(`${baseURL}/invalid-id-format`, headersA);
      } catch (e) {
        assert.strictEqual(e.response?.status, 400);
        deleteHandled = true;
      }
      assert.ok(deleteHandled);

      recordPass('13. Invalid post ID handling', 'HTTP 400 returned for malformed ObjectId on PUT and DELETE');
    } catch (err) {
      recordFail('13. Invalid post ID handling', err);
    }

    // -------------------------------------------------------------------------
    // TEST 14: Invalid update payload handling
    // -------------------------------------------------------------------------
    try {
      // Empty title
      let emptyTitleRejected = false;
      try {
        await axios.put(`${baseURL}/${postA1._id}`, { title: '   ' }, headersA);
      } catch (e) {
        assert.strictEqual(e.response?.status, 400);
        emptyTitleRejected = true;
      }
      assert.ok(emptyTitleRejected);

      // Invalid status
      let invalidStatusRejected = false;
      try {
        await axios.put(`${baseURL}/${postA1._id}`, { status: 'archived' }, headersA);
      } catch (e) {
        assert.strictEqual(e.response?.status, 400);
        invalidStatusRejected = true;
      }
      assert.ok(invalidStatusRejected);

      // Malformed coverImage URL
      let badCoverImageRejected = false;
      try {
        await axios.put(`${baseURL}/${postA1._id}`, { coverImage: 'not-a-valid-url' }, headersA);
      } catch (e) {
        assert.strictEqual(e.response?.status, 400);
        badCoverImageRejected = true;
      }
      assert.ok(badCoverImageRejected);

      recordPass('14. Invalid update payload handling', 'HTTP 400 returned on invalid title, status, or coverImage');
    } catch (err) {
      recordFail('14. Invalid update payload handling', err);
    }

    // -------------------------------------------------------------------------
    // TEST 15: Author spoofing is rejected or ignored safely
    // -------------------------------------------------------------------------
    try {
      const fakeAuthorId = new mongoose.Types.ObjectId();
      const spoofRes = await axios.put(
        `${baseURL}/${postA1._id}`,
        {
          author: fakeAuthorId,
        },
        headersA
      );
      assert.strictEqual(spoofRes.status, 200);
      assert.strictEqual(spoofRes.data.post.author._id.toString(), userA._id.toString());
      recordPass('15. Author spoofing is rejected or ignored safely', 'Body author ignored; author immutably maintained');
    } catch (err) {
      recordFail('15. Author spoofing is rejected or ignored safely', err);
    }

    // -------------------------------------------------------------------------
    // TEST 16: Updated title maintains unique slug behavior
    // -------------------------------------------------------------------------
    try {
      // Change title of postB1 to match postA1's title
      const updatedB1Res = await axios.put(
        `${baseURL}/${postB1._id}`,
        {
          title: `Updated Title A1 ${testRunId}`, // Same title as postA1!
        },
        headersB
      );
      assert.strictEqual(updatedB1Res.status, 200);
      // Verify slug was disambiguated
      assert.notStrictEqual(updatedB1Res.data.post.slug, postA1.slug);
      assert.ok(updatedB1Res.data.post.slug.includes('updated-title-a1'));
      recordPass('16. Updated title maintains unique slug behavior', 'Unique slug generated when title updated to existing slug');
    } catch (err) {
      recordFail('16. Updated title maintains unique slug behavior', err);
    }

    // -------------------------------------------------------------------------
    // TEST 17: Existing Day 6 post creation tests continue passing
    // -------------------------------------------------------------------------
    try {
      const newPostRes = await axios.post(
        baseURL,
        {
          title: `Regression Post Creation ${testRunId}`,
          content: 'Content for regression test.',
          status: 'published',
        },
        headersA
      );
      assert.strictEqual(newPostRes.status, 201);
      assert.strictEqual(newPostRes.data.post.status, 'published');
      createdPostIds.push(newPostRes.data.post._id);
      recordPass('17. Existing Day 6 post creation tests continue passing', 'POST /api/posts regression passes cleanly');
    } catch (err) {
      recordFail('17. Existing Day 6 post creation tests continue passing', err);
    }

  } catch (globalErr) {
    console.error('Fatal error in Day 7 tests:', globalErr);
  } finally {
    // Cleanup
    try {
      if (createdPostIds.length > 0) {
        await Post.deleteMany({ _id: { $in: createdPostIds } });
        console.log(`[Cleanup] Deleted ${createdPostIds.length} test post(s).`);
      }
      if (userA) await User.findByIdAndDelete(userA._id);
      if (userB) await User.findByIdAndDelete(userB._id);
      if (tag1) await Tag.findByIdAndDelete(tag1._id);
      if (tag2) await Tag.findByIdAndDelete(tag2._id);
      console.log('[Cleanup] Test users and tags deleted.');
      await mongoose.disconnect();
      console.log('[Cleanup] Disconnected from MongoDB Atlas.');
    } catch (cleanupErr) {
      console.warn('[Cleanup] Warning during cleanup:', cleanupErr.message);
    }

    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
      console.log('[Cleanup] Day 7 test server closed.');
    }
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log(`\n==================================================`);
  console.log(`DAY 7 TEST SUMMARY: ${passed}/${results.length} PASSED (${failed} FAILED)`);
  console.log(`==================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runDay7Tests();

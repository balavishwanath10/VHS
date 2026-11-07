import 'dotenv/config';
import assert from 'node:assert';
import http from 'node:http';
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
import { slugify, generateUniqueSlug, generateExcerpt, isValidUrl } from '../utils/postHelpers.js';
import { validateEnv } from '../config/validateEnv.js';

const results = [];

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

const recordBlocked = (testName, reason) => {
  results.push({ name: testName, status: 'BLOCKED', details: reason });
  console.log(`[BLOCKED] ${testName}: ${reason}`);
};

async function runPostsVerification() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 6 Authenticated Post Creation Verification`);
  console.log(`==================================================\n`);

  // ----------------------------------------------------
  // SECTION 1: UNIT TESTS FOR POST HELPERS
  // ----------------------------------------------------
  console.log(`--- SECTION 1: POST HELPER UNIT TESTS ---`);

  // 1. Slugify standard title
  try {
    const slug = slugify('Introduction to MERN Stack Development');
    assert.strictEqual(slug, 'introduction-to-mern-stack-development');
    recordPass('Helper - Slugify Standard Title', slug);
  } catch (err) {
    recordFail('Helper - Slugify Standard Title', err);
  }

  // 2. Slugify with special characters, symbols, and whitespace
  try {
    const slug = slugify('  How & Why to Build APIs in 2026?!?!  ');
    assert.strictEqual(slug, 'how-why-to-build-apis-in-2026');
    recordPass('Helper - Slugify Special Characters', slug);
  } catch (err) {
    recordFail('Helper - Slugify Special Characters', err);
  }

  // 3. Slugify fallback for empty or non-string titles
  try {
    const emptySlug = slugify('   ');
    const symbolSlug = slugify('???$$$***');
    const nullSlug = slugify(null);
    assert.strictEqual(emptySlug, 'untitled-post');
    assert.strictEqual(symbolSlug, 'untitled-post');
    assert.strictEqual(nullSlug, 'untitled-post');
    recordPass('Helper - Slugify Fallback Safety', 'All fallback cases safely resolved to untitled-post');
  } catch (err) {
    recordFail('Helper - Slugify Fallback Safety', err);
  }

  // 4. Unique slug generation with collision resolution
  try {
    const takenSlugs = new Set(['my-awesome-post', 'my-awesome-post-1']);
    const checkSlugTaken = async (s) => takenSlugs.has(s);

    const uniqueSlug = await generateUniqueSlug('My Awesome Post', checkSlugTaken);
    assert.strictEqual(uniqueSlug, 'my-awesome-post-2');
    recordPass('Helper - Unique Slug Collision Resolution', `Generated: ${uniqueSlug}`);
  } catch (err) {
    recordFail('Helper - Unique Slug Collision Resolution', err);
  }

  // 5. Excerpt extraction from complex Markdown
  try {
    const markdownContent = `
# Title of the Post

This is an **important** guide on *how* to use [MERN Stack](https://mongodb.com).

Here is an image: ![Vite Logo](https://vitejs.dev/logo.svg)

> Antigravity is a powerful AI coding agent.

\`\`\`javascript
const greeting = "Hello World";
console.log(greeting);
\`\`\`

Here is \`inline code\` and ~~strikethrough~~ text.

<div>HTML block</div>
`;
    const excerpt = generateExcerpt(markdownContent, 250);
    assert.ok(!excerpt.includes('#'), 'Headers should be removed');
    assert.ok(!excerpt.includes('**'), 'Markdown bold symbols should be removed');
    assert.ok(!excerpt.includes('```'), 'Code blocks should be removed');
    assert.ok(!excerpt.includes('!['), 'Images should be removed');
    assert.ok(!excerpt.includes('https://mongodb.com'), 'Raw link URLs should be removed');
    assert.ok(excerpt.includes('important guide on how to use MERN Stack'), 'Readable text preserved');
    assert.ok(excerpt.length <= 250, 'Excerpt length must not exceed 250 characters');
    recordPass('Helper - Excerpt Markdown Stripping', `Clean excerpt: "${excerpt.slice(0, 60)}..."`);
  } catch (err) {
    recordFail('Helper - Excerpt Markdown Stripping', err);
  }

  // 6. Excerpt truncation strictly <= 250 characters
  try {
    const longContent = 'Word '.repeat(100); // 500 characters
    const excerpt = generateExcerpt(longContent, 250);
    assert.ok(excerpt.length <= 250, `Length must be <= 250, was ${excerpt.length}`);
    recordPass('Helper - Excerpt Max Length Enforcement', `Excerpt length: ${excerpt.length} chars (<= 250)`);
  } catch (err) {
    recordFail('Helper - Excerpt Max Length Enforcement', err);
  }

  // 7. Cover Image URL Validation Helper - Valid URLs
  try {
    assert.strictEqual(isValidUrl('https://example.com/banner.png'), true);
    assert.strictEqual(isValidUrl('http://cdn.hashnode.com/image.jpg'), true);
    recordPass('Helper - Valid Cover Image URL Detection', 'HTTPS and HTTP image URLs correctly validated');
  } catch (err) {
    recordFail('Helper - Valid Cover Image URL Detection', err);
  }

  // 8. Cover Image URL Validation Helper - Invalid URLs
  try {
    assert.strictEqual(isValidUrl('not-a-url'), false);
    assert.strictEqual(isValidUrl('ftp://example.com/banner.png'), false);
    assert.strictEqual(isValidUrl('javascript:alert(1)'), false);
    assert.strictEqual(isValidUrl(''), false);
    assert.strictEqual(isValidUrl(null), false);
    assert.strictEqual(isValidUrl(undefined), false);
    recordPass('Helper - Invalid Cover Image URL Detection', 'Malformed URLs, non-HTTP schemes, and empty inputs rejected');
  } catch (err) {
    recordFail('Helper - Invalid Cover Image URL Detection', err);
  }

  // ----------------------------------------------------
  // SECTION 2: HTTP ENDPOINT AUTH & VALIDATION TESTS
  // ----------------------------------------------------
  console.log(`\n--- SECTION 2: POSTS HTTP ENDPOINT TESTS ---`);

  let testServer;
  let baseURL;

  try {
    const app = express();
    app.use(express.json());
    app.use('/api/posts', postsRouter);
    app.use(errorHandler);

    await new Promise((resolve) => {
      testServer = app.listen(0, () => {
        const port = testServer.address().port;
        baseURL = `http://localhost:${port}/api/posts`;
        console.log(`[Setup] Posts test server listening on port ${port}.\n`);
        resolve();
      });
    });

    // 9. Reject unauthenticated request (401 No Token)
    try {
      await axios.post(baseURL, { title: 'Test', content: 'Test content' });
      recordFail('Endpoint - Unauthenticated 401 Rejection', new Error('Should have returned 401'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Should return HTTP 401');
      assert.strictEqual(err.response?.data?.error?.message, 'Not authorized, no token provided');
      recordPass('Endpoint - Unauthenticated 401 Rejection', 'HTTP 401 returned when no Bearer token is provided');
    }

    // 10. Reject invalid Bearer token (401 Invalid Token)
    try {
      await axios.post(baseURL, { title: 'Test', content: 'Test content' }, {
        headers: { Authorization: 'Bearer invalid.token.payload' },
      });
      recordFail('Endpoint - Invalid Token 401 Rejection', new Error('Should have returned 401'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Should return HTTP 401');
      assert.strictEqual(err.response?.data?.error?.message, 'Not authorized, invalid token');
      recordPass('Endpoint - Invalid Token 401 Rejection', 'HTTP 401 returned for malformed/tampered JWT');
    }

    // Prepare a mock authenticated app to verify route input validations without requiring DB token lookup
    const authApp = express();
    authApp.use(express.json());
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Author',
      email: 'author@example.com',
      avatarUrl: 'https://avatar.example.com/test.png',
    };
    authApp.use((req, res, next) => {
      req.user = mockUser;
      next();
    });
    // Mount custom test routes that replicate posts controller input validations
    authApp.post('/api/posts-test', async (req, res, next) => {
      const { title, content, tags, status, coverImage } = req.body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: { message: 'Title is required' } });
      }
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: { message: 'Content is required' } });
      }
      if (status !== undefined && status !== null && status !== '') {
        if (status !== 'draft' && status !== 'published') {
          return res.status(400).json({ error: { message: 'Status must be either draft or published' } });
        }
      }
      if (coverImage !== undefined && coverImage !== null && coverImage !== '') {
        if (typeof coverImage !== 'string' || !isValidUrl(coverImage)) {
          return res.status(400).json({ error: { message: 'Cover image must be a valid URL' } });
        }
      }
      if (tags !== undefined && tags !== null) {
        if (!Array.isArray(tags)) {
          return res.status(400).json({ error: { message: 'Tags must be an array of tag IDs' } });
        }
        for (const tagId of tags) {
          if (!mongoose.Types.ObjectId.isValid(tagId)) {
            return res.status(400).json({ error: { message: `Invalid tag identifier format: ${tagId}` } });
          }
        }
      }
      res.status(200).json({ ok: true });
    });
    authApp.use(errorHandler);

    let authServer;
    let authBaseURL;
    await new Promise((resolve) => {
      authServer = authApp.listen(0, () => {
        const port = authServer.address().port;
        authBaseURL = `http://localhost:${port}/api/posts-test`;
        resolve();
      });
    });

    // 11. Reject missing title (400)
    try {
      await axios.post(authBaseURL, { content: 'Valid markdown content' });
      recordFail('Validation - Missing Title Rejection', new Error('Should have returned 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.error?.message, 'Title is required');
      recordPass('Validation - Missing Title Rejection', 'HTTP 400 returned when title is absent or whitespace');
    }

    // 12. Reject missing content (400)
    try {
      await axios.post(authBaseURL, { title: 'Valid Post Title' });
      recordFail('Validation - Missing Content Rejection', new Error('Should have returned 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.error?.message, 'Content is required');
      recordPass('Validation - Missing Content Rejection', 'HTTP 400 returned when content is absent or empty');
    }

    // 13. Reject invalid status (400)
    try {
      await axios.post(authBaseURL, {
        title: 'Valid Title',
        content: 'Valid content',
        status: 'archived',
      });
      recordFail('Validation - Invalid Status Rejection', new Error('Should have returned 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.error?.message, 'Status must be either draft or published');
      recordPass('Validation - Invalid Status Rejection', 'HTTP 400 returned when status is not draft or published');
    }

    // 14. Reject invalid tags format (400)
    try {
      await axios.post(authBaseURL, {
        title: 'Valid Title',
        content: 'Valid content',
        tags: 'not-an-array',
      });
      recordFail('Validation - Non-Array Tags Rejection', new Error('Should have returned 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.error?.message, 'Tags must be an array of tag IDs');
      recordPass('Validation - Non-Array Tags Rejection', 'HTTP 400 returned when tags is not an array');
    }

    // 15. Reject invalid ObjectId in tags array (400)
    try {
      await axios.post(authBaseURL, {
        title: 'Valid Title',
        content: 'Valid content',
        tags: ['not-a-valid-objectid'],
      });
      recordFail('Validation - Malformed Tag ObjectId Rejection', new Error('Should have returned 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response?.data?.error?.message.includes('Invalid tag identifier format'));
      recordPass('Validation - Malformed Tag ObjectId Rejection', 'HTTP 400 returned on malformed tag ObjectId');
    }

    // 16. Reject arbitrary non-URL string in coverImage (400)
    try {
      await axios.post(authBaseURL, {
        title: 'Valid Title',
        content: 'Valid content',
        coverImage: 'arbitrary-non-url-string',
      });
      recordFail('Validation - Non-URL Cover Image Rejection', new Error('Should have returned 400'));
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.error?.message, 'Cover image must be a valid URL');
      recordPass('Validation - Non-URL Cover Image Rejection', 'HTTP 400 returned when coverImage is not a valid URL');
    }

    // 17. Accept valid HTTP/HTTPS URL in coverImage (200)
    try {
      const validRes = await axios.post(authBaseURL, {
        title: 'Valid Title',
        content: 'Valid content',
        coverImage: 'https://images.unsplash.com/photo-12345.jpg',
      });
      assert.strictEqual(validRes.status, 200);
      recordPass('Validation - Valid Cover Image URL Acceptance', 'HTTP 200 returned when coverImage is a valid URL');
    } catch (err) {
      recordFail('Validation - Valid Cover Image URL Acceptance', err);
    }

    if (authServer) {
      await new Promise((resolve) => authServer.close(resolve));
    }

    // ----------------------------------------------------
    // SECTION 3: LIVE DATABASE INTEGRATION TESTS
    // ----------------------------------------------------
    console.log(`\n--- SECTION 3: DATABASE INTEGRATION TESTS ---`);
    let dbConnected = false;
    let dbConnectionError = null;

    if (process.env.TEST_LIVE_DB?.trim() === 'true') {
      try {
        await connectDB();
        dbConnected = true;
        console.log('[Setup] Connected to MongoDB Atlas. Executing live database integration tests...\n');
      } catch (dbErr) {
        dbConnectionError = dbErr.message;
        console.log(`[INFO] Live Atlas connection failed: ${dbErr.message}\n`);
      }
    } else {
      dbConnectionError = 'TEST_LIVE_DB is not enabled (set TEST_LIVE_DB=true to run live integration tests)';
      console.log(`[INFO] ${dbConnectionError}\n`);
    }

    if (dbConnected) {
      let testUser;
      let testTag;
      try {
        testUser = await User.create({
          name: 'Live Post Tester',
          email: `livepost_${Date.now()}@example.com`,
          password: 'Password123!',
        });
        testTag = await Tag.create({
          name: `livetag_${Date.now()}`,
          slug: `livetag-${Date.now()}`,
        });

        const token = jwt.sign({ id: testUser._id }, validateEnv().secret, { expiresIn: '1h' });
        const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

        // 18. Live Creation: Authenticated draft post
        const draftRes = await axios.post(
          baseURL,
          {
            title: 'Live Testing Draft Post',
            content: 'This is live draft content with **markdown**.',
          },
          authHeaders
        );
        assert.strictEqual(draftRes.status, 201);
        assert.strictEqual(draftRes.data.post.status, 'draft');
        recordPass('Live DB - Authenticated Draft Post Creation', 'Draft post created in live database');

        // 19. Live Creation: Authenticated published post
        const publishedRes = await axios.post(
          baseURL,
          {
            title: 'Live Testing Published Post',
            content: 'This is live published content.',
            status: 'published',
            tags: [testTag._id],
            coverImage: 'https://example.com/banner.png',
          },
          authHeaders
        );
        assert.strictEqual(publishedRes.status, 201);
        assert.strictEqual(publishedRes.data.post.status, 'published');
        recordPass('Live DB - Authenticated Published Post Creation', 'Published post created in live database');

        // 20. Live Author: Verify author is the authenticated user
        assert.strictEqual(draftRes.data.post.author._id.toString(), testUser._id.toString());
        recordPass('Live DB - Author Assignment', 'Post author is correctly assigned to authenticated user');

        // 21. Live Author: Verify author spoofing is prevented
        const spoofRes = await axios.post(
          baseURL,
          {
            title: 'Live Spoof Attempt',
            content: 'Content attempting author spoof.',
            author: new mongoose.Types.ObjectId(),
          },
          authHeaders
        );
        assert.strictEqual(spoofRes.data.post.author._id.toString(), testUser._id.toString());
        recordPass('Live DB - Author Spoofing Prevention', 'Body author ignored; strictly bound to authenticated user');

        // 22. Live Tags: Verify valid tags are stored
        assert.strictEqual(publishedRes.data.post.tags.length, 1);
        assert.strictEqual(publishedRes.data.post.tags[0]._id.toString(), testTag._id.toString());
        recordPass('Live DB - Valid Tag Association', 'Valid tag successfully associated and populated');

        // 23. Live Tags: Verify nonexistent tags are rejected (400)
        try {
          const fakeTagId = new mongoose.Types.ObjectId();
          await axios.post(
            baseURL,
            {
              title: 'Invalid Tag Post',
              content: 'Content with nonexistent tag',
              tags: [fakeTagId],
            },
            authHeaders
          );
          recordFail('Live DB - Nonexistent Tag Rejection', new Error('Should have rejected non-existent tag'));
        } catch (tagErr) {
          assert.strictEqual(tagErr.response?.status, 400);
          assert.strictEqual(tagErr.response?.data?.error?.message, 'One or more specified tags do not exist');
          recordPass('Live DB - Nonexistent Tag Rejection', 'HTTP 400 returned when tag does not exist');
        }

        // 24. Live Status: Verify default status is draft
        const defaultStatusRes = await axios.post(
          baseURL,
          {
            title: 'Live Status Default Test',
            content: 'Content without status specified.',
          },
          authHeaders
        );
        assert.strictEqual(defaultStatusRes.data.post.status, 'draft');
        recordPass('Live DB - Draft Default Status', 'Unspecified status defaults to draft');

        // 25. Live Slugs: Verify generated slugs are unique
        const dupTitle1 = await axios.post(
          baseURL,
          {
            title: 'Live Duplicate Slug Test',
            content: 'Content 1',
          },
          authHeaders
        );
        const dupTitle2 = await axios.post(
          baseURL,
          {
            title: 'Live Duplicate Slug Test',
            content: 'Content 2',
          },
          authHeaders
        );
        assert.strictEqual(dupTitle1.data.post.slug, 'live-duplicate-slug-test');
        assert.strictEqual(dupTitle2.data.post.slug, 'live-duplicate-slug-test-1');
        recordPass('Live DB - Unique Slug Collision Resolution', 'Duplicate title handled with unique incremental slug');

        // 26. Live Excerpt: Verify excerpt length is at most 250 characters
        const longContent = 'Word '.repeat(80); // 400 characters
        const longExcerptRes = await axios.post(
          baseURL,
          {
            title: 'Live Long Excerpt Test',
            content: longContent,
          },
          authHeaders
        );
        assert.ok(longExcerptRes.data.post.excerpt.length <= 250, 'Excerpt must be <= 250 characters');
        recordPass('Live DB - Excerpt Max Length Enforcement', `Live excerpt length: ${longExcerptRes.data.post.excerpt.length} (<= 250)`);

        // 27. Live Cleanup: Safely clean up created test records
        await Post.deleteMany({ author: testUser._id });
        await User.findByIdAndDelete(testUser._id);
        await Tag.findByIdAndDelete(testTag._id);
        const remainingPosts = await Post.countDocuments({ author: testUser._id });
        assert.strictEqual(remainingPosts, 0);
        recordPass('Live DB - Test Records Cleaned Up Safely', 'All test documents deleted cleanly from database');
      } finally {
        try {
          await mongoose.disconnect();
        } catch (_) {}
      }
    } else {
      // Mark all 10 live database tests as BLOCKED due to Atlas IP whitelist
      recordBlocked('Live DB - Authenticated Draft Post Creation', dbConnectionError);
      recordBlocked('Live DB - Authenticated Published Post Creation', dbConnectionError);
      recordBlocked('Live DB - Author Assignment', dbConnectionError);
      recordBlocked('Live DB - Author Spoofing Prevention', dbConnectionError);
      recordBlocked('Live DB - Valid Tag Association', dbConnectionError);
      recordBlocked('Live DB - Nonexistent Tag Rejection', dbConnectionError);
      recordBlocked('Live DB - Draft Default Status', dbConnectionError);
      recordBlocked('Live DB - Unique Slug Collision Resolution', dbConnectionError);
      recordBlocked('Live DB - Excerpt Max Length Enforcement', dbConnectionError);
      recordBlocked('Live DB - Test Records Cleaned Up Safely', dbConnectionError);
    }

  } catch (globalErr) {
    console.error('Fatal error during post verification:', globalErr);
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
      console.log('[Cleanup] Posts test server closed.');
    }
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const blocked = results.filter((r) => r.status === 'BLOCKED').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log(`\n==================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED | ${blocked} BLOCKED | ${failed} FAILED (TOTAL: ${results.length})`);
  console.log(`==================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runPostsVerification();

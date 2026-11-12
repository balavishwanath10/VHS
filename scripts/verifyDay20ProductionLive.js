/**
 * VHS Day 20 Production Live Smoke Verification Script
 * Validates real production deployment on Render against live MongoDB Atlas.
 *
 * Usage:
 *   node scripts/verifyDay20ProductionLive.js <PRODUCTION_URL>
 * Example:
 *   node scripts/verifyDay20ProductionLive.js https://vhs.onrender.com
 */

import assert from 'assert';
import axios from 'axios';

const targetUrl = process.argv[2] ? process.argv[2].replace(/\/+$/, '') : process.env.PRODUCTION_URL;

if (!targetUrl) {
  console.error('\n[ERROR] Production URL is required.');
  console.error('Usage: node scripts/verifyDay20ProductionLive.js https://<service-name>.onrender.com');
  process.exit(1);
}

console.log('\n==================================================');
console.log(`VHS Day 20 Live Production Verification: ${targetUrl}`);
console.log('==================================================\n');

let passCount = 0;
let failCount = 0;

async function runCheck(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

async function execute() {
  const testId = `prod_${Date.now()}`;
  let authToken = null;
  let testUserId = null;
  let testPostId = null;
  let testPostSlug = null;
  let testTagId = null;
  const testTagName = `deploy-${testId.slice(-6)}`;

  // -------------------------------------------------------------
  // Phase 1: Infrastructure & Health
  // -------------------------------------------------------------
  console.log('--- Phase 1: Infrastructure & Health Checks ---');

  await runCheck('1. Root URL loads successfully with HTML content', async () => {
    const res = await axios.get(`${targetUrl}/`);
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.data === 'string' && res.data.includes('<div id="root"></div>'));
  });

  await runCheck('2. Operational Health Check (/api/health) reports database connected', async () => {
    const res = await axios.get(`${targetUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.strictEqual(res.data.database.connected, true);
    assert.strictEqual(res.data.database.status, 'connected');
  });

  await runCheck('3. SPA client-side fallback serves index.html for non-API routes', async () => {
    const res = await axios.get(`${targetUrl}/dashboard`);
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.data === 'string' && res.data.includes('<div id="root"></div>'));
  });

  await runCheck('4. Unmatched API route (/api/*) returns HTTP 404 JSON (not HTML fallback)', async () => {
    try {
      await axios.get(`${targetUrl}/api/unmatched-endpoint-${Date.now()}`);
      assert.fail('Expected 404 error');
    } catch (err) {
      assert.ok(err.response, 'No response received');
      assert.strictEqual(err.response.status, 404);
      assert.strictEqual(typeof err.response.data, 'object');
      assert.ok(err.response.data.error || err.response.data.message);
    }
  });

  await runCheck('5. Unauthenticated request to protected route is rejected with HTTP 401', async () => {
    try {
      await axios.post(`${targetUrl}/api/posts`, { title: 'Test', content: 'Test' });
      assert.fail('Expected 401 error');
    } catch (err) {
      assert.ok(err.response, 'No response received');
      assert.strictEqual(err.response.status, 401);
    }
  });

  // -------------------------------------------------------------
  // Phase 2: Live Authentication
  // -------------------------------------------------------------
  console.log('\n--- Phase 2: Live Authentication Lifecycle ---');

  const testEmail = `${testId}@example.com`;
  const testPassword = 'Password123!';

  await runCheck('6. User registration succeeds and returns sanitized user object', async () => {
    const res = await axios.post(`${targetUrl}/api/auth/register`, {
      name: `Deploy Test ${testId}`,
      email: testEmail,
      password: testPassword,
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.user);
    assert.strictEqual(res.data.user.email, testEmail.toLowerCase());
    assert.strictEqual(res.data.user.password, undefined);
    assert.ok(res.data.token);
    authToken = res.data.token;
    testUserId = res.data.user._id || res.data.user.id;
  });

  await runCheck('7. Session restoration via GET /api/auth/me returns authenticated user', async () => {
    const res = await axios.get(`${targetUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.email, testEmail.toLowerCase());
    assert.strictEqual(res.data.user.password, undefined);
  });

  // -------------------------------------------------------------
  // Phase 3: Post Publishing & Draft Privacy
  // -------------------------------------------------------------
  console.log('\n--- Phase 3: Post Publishing, Draft Privacy & Ownership ---');

  await runCheck('8. Tag creation via POST /api/tags succeeds', async () => {
    const res = await axios.post(
      `${targetUrl}/api/tags`,
      { name: testTagName },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    assert.ok(res.status === 200 || res.status === 201);
    assert.ok(res.data.tag);
    testTagId = res.data.tag._id;
  });

  await runCheck('9. Create draft post via POST /api/posts', async () => {
    const res = await axios.post(
      `${targetUrl}/api/posts`,
      {
        title: `Draft Post ${testId}`,
        content: `# Live Production Test\n\nThis is a draft article created by ${testId}.`,
        status: 'draft',
        tags: testTagId ? [testTagId] : [],
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.post.status, 'draft');
    testPostId = res.data.post._id;
    testPostSlug = res.data.post.slug;
  });

  await runCheck('10. Draft post does NOT appear in public feed (/api/posts)', async () => {
    const res = await axios.get(`${targetUrl}/api/posts`);
    assert.strictEqual(res.status, 200);
    const found = res.data.posts.some((p) => p._id === testPostId || p.slug === testPostSlug);
    assert.strictEqual(found, false, 'Draft post leaked into public feed!');
  });

  await runCheck('11. Unauthenticated request to draft slug returns HTTP 404', async () => {
    try {
      await axios.get(`${targetUrl}/api/posts/${testPostSlug}`);
      assert.fail('Expected 404 error');
    } catch (err) {
      assert.ok(err.response);
      assert.strictEqual(err.response.status, 404);
    }
  });

  await runCheck('12. Author publishes post via PUT /api/posts/:id', async () => {
    const res = await axios.put(
      `${targetUrl}/api/posts/${testPostId}`,
      {
        title: `Published Post ${testId}`,
        content: `# Published Production Test\n\nVerified live on Render at ${new Date().toISOString()}`,
        status: 'published',
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.post.status, 'published');
    testPostSlug = res.data.post.slug;
  });

  await runCheck('13. Published post appears in public feed and is readable by slug', async () => {
    const feedRes = await axios.get(`${targetUrl}/api/posts`);
    assert.strictEqual(feedRes.status, 200);
    const found = feedRes.data.posts.some((p) => p._id === testPostId);
    assert.strictEqual(found, true, 'Published post missing from public feed!');

    const detailRes = await axios.get(`${targetUrl}/api/posts/${testPostSlug}`);
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailRes.data.post._id, testPostId);
  });

  // -------------------------------------------------------------
  // Phase 4: Tag Feeds & Search
  // -------------------------------------------------------------
  console.log('\n--- Phase 4: Tags, Topic Feeds & Search ---');

  await runCheck('14. Tag topic feed (/api/tags/:slug/posts) returns published post', async () => {
    const res = await axios.get(`${targetUrl}/api/tags/${testTagName}/posts`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.posts);
    const found = res.data.posts.some((p) => p._id === testPostId);
    assert.strictEqual(found, true, 'Published post missing from tag feed');
  });

  await runCheck('15. Search query param (?search=) matches published article', async () => {
    const res = await axios.get(`${targetUrl}/api/posts?search=${testId}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.posts);
    const found = res.data.posts.some((p) => p._id === testPostId);
    assert.strictEqual(found, true, 'Search failed to match post');
  });

  // -------------------------------------------------------------
  // Phase 5: Profiles & Settings
  // -------------------------------------------------------------
  console.log('\n--- Phase 5: Profiles & Account Settings ---');

  await runCheck('16. Profile update via PUT /api/users/me succeeds', async () => {
    const res = await axios.put(
      `${targetUrl}/api/users/me`,
      {
        name: `Updated Test ${testId}`,
        bio: 'Automated Day 20 Production Smoke Test Runner',
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.bio, 'Automated Day 20 Production Smoke Test Runner');
  });

  await runCheck('17. Public profile (/api/users/:id) returns published stories', async () => {
    const res = await axios.get(`${targetUrl}/api/users/${testUserId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.bio, 'Automated Day 20 Production Smoke Test Runner');
    assert.ok(Array.isArray(res.data.posts));
    const found = res.data.posts.some((p) => p._id === testPostId);
    assert.strictEqual(found, true, 'Public profile missing published post');
  });

  // -------------------------------------------------------------
  // Phase 6: Post Deletion & Cleanup
  // -------------------------------------------------------------
  console.log('\n--- Phase 6: Cleanup & Post Deletion ---');

  await runCheck('18. Author deletes post via DELETE /api/posts/:id', async () => {
    const res = await axios.delete(`${targetUrl}/api/posts/${testPostId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.strictEqual(res.status, 200);

    // Verify retrieval fails
    try {
      await axios.get(`${targetUrl}/api/posts/${testPostSlug}`);
      assert.fail('Expected 404 after deletion');
    } catch (err) {
      assert.strictEqual(err.response.status, 404);
    }
  });

  console.log('\n==================================================');
  console.log(`PRODUCTION LIVE VERIFICATION: ${passCount}/${passCount + failCount} PASSED (${failCount} FAILED)`);
  console.log('==================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

execute().catch((err) => {
  console.error('[FATAL ERROR]', err.message);
  process.exit(1);
});

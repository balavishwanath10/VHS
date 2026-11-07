import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const results = [];

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runDay11Verification() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 11 Protected Routes & Private Dashboard Verification`);
  console.log(`==================================================\n`);

  const protectedRouteContent = fs.readFileSync(
    path.resolve(rootDir, 'src', 'components', 'ProtectedRoute.jsx'),
    'utf8'
  );
  const appContent = fs.readFileSync(path.resolve(rootDir, 'src', 'App.jsx'), 'utf8');
  const dashboardContent = fs.readFileSync(
    path.resolve(rootDir, 'src', 'pages', 'Dashboard.jsx'),
    'utf8'
  );

  // -------------------------------------------------------------------------
  // TEST 1: ProtectedRoute checks authentication status
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      protectedRouteContent.includes('const { isAuthenticated, loading } = useAuth()'),
      'ProtectedRoute must destructure isAuthenticated and loading from useAuth'
    );
    recordPass('1. ProtectedRoute checks authentication status', 'ProtectedRoute observes isAuthenticated and loading from AuthContext');
  } catch (err) {
    recordFail('1. ProtectedRoute checks authentication status', err);
  }

  // -------------------------------------------------------------------------
  // TEST 2: ProtectedRoute redirects unauthenticated visitors to /login
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      protectedRouteContent.includes('!isAuthenticated'),
      'ProtectedRoute must check !isAuthenticated'
    );
    assert.ok(
      protectedRouteContent.includes('<Navigate to="/login"'),
      'ProtectedRoute must render Navigate to /login'
    );
    assert.ok(
      protectedRouteContent.includes('replace'),
      'ProtectedRoute must use replace to avoid history loops'
    );
    recordPass('2. ProtectedRoute redirects to /login', 'Unauthenticated navigation redirected with replace history');
  } catch (err) {
    recordFail('2. ProtectedRoute redirects to /login', err);
  }

  // -------------------------------------------------------------------------
  // TEST 3: ProtectedRoute allows authenticated access to children
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      protectedRouteContent.includes('return children'),
      'ProtectedRoute must return children when authenticated'
    );
    recordPass('3. ProtectedRoute renders children when authenticated', 'Authenticated visitors cleanly render target component');
  } catch (err) {
    recordFail('3. ProtectedRoute renders children when authenticated', err);
  }

  // -------------------------------------------------------------------------
  // TEST 4: ProtectedRoute displays loading while session is restoring
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      protectedRouteContent.includes('if (loading)'),
      'ProtectedRoute must check loading state'
    );
    assert.ok(
      protectedRouteContent.includes('Verifying session...'),
      'ProtectedRoute must display loading feedback'
    );
    recordPass('4. ProtectedRoute displays session verification loading state', 'Prevents unauthenticated flash before session restores');
  } catch (err) {
    recordFail('4. ProtectedRoute displays session verification loading state', err);
  }

  // -------------------------------------------------------------------------
  // TEST 5: App.jsx wraps protected routes
  // -------------------------------------------------------------------------
  try {
    const protectedRoutes = ['/dashboard', '/editor/new', '/editor/:id', '/settings'];
    for (const route of protectedRoutes) {
      const regex = new RegExp(`path="${route.replace('/', '\\/')}"[\\s\\S]*?<ProtectedRoute>`);
      assert.ok(regex.test(appContent), `Route ${route} must be wrapped in <ProtectedRoute>`);
    }
    recordPass('5. App.jsx wraps all required protected routes', 'Dashboard, Editor (new/id), and Settings guarded by ProtectedRoute');
  } catch (err) {
    recordFail('5. App.jsx wraps all required protected routes', err);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Dashboard fetches user posts from GET /api/posts/mine
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      /api\s*\.\s*get\(\s*['"]\/posts\/mine['"]\s*\)/.test(dashboardContent),
      'Dashboard must call api.get(/posts/mine)'
    );
    assert.ok(
      dashboardContent.includes('setPosts(res.data.posts'),
      'Dashboard must populate posts state with res.data.posts'
    );
    recordPass('6. Dashboard fetches user posts via GET /api/posts/mine', 'Dashboard connects to author posts endpoint');
  } catch (err) {
    recordFail('6. Dashboard fetches user posts via GET /api/posts/mine', err);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Dashboard displays both published and draft posts
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      dashboardContent.includes("post.status === 'draft'"),
      'Dashboard must inspect draft status'
    );
    assert.ok(
      dashboardContent.includes("post.status === 'published'"),
      'Dashboard must inspect published status'
    );
    assert.ok(
      dashboardContent.includes('draftCount'),
      'Dashboard computes draft count metric'
    );
    assert.ok(
      dashboardContent.includes('publishedCount'),
      'Dashboard computes published count metric'
    );
    recordPass('7. Dashboard handles both published and draft posts', 'Draft and published statuses handled with summary counts');
  } catch (err) {
    recordFail('7. Dashboard handles both published and draft posts', err);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Distinct Draft and Published badge indicators
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      dashboardContent.includes('badge-draft'),
      'Dashboard must assign badge-draft CSS class'
    );
    assert.ok(
      dashboardContent.includes('badge-published'),
      'Dashboard must assign badge-published CSS class'
    );
    assert.ok(
      dashboardContent.includes("'Draft' : 'Published'"),
      'Dashboard must display readable status labels'
    );
    recordPass('8. Distinct Draft and Published badge indicators', 'Draft and Published badges visually distinguished');
  } catch (err) {
    recordFail('8. Distinct Draft and Published badge indicators', err);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Post metadata rendered (title, excerpt, date, tags)
  // -------------------------------------------------------------------------
  try {
    assert.ok(dashboardContent.includes('{post.title}'), 'Dashboard must render post.title');
    assert.ok(dashboardContent.includes('{post.excerpt}'), 'Dashboard must render post.excerpt');
    assert.ok(dashboardContent.includes('post.createdAt'), 'Dashboard must format post.createdAt');
    assert.ok(dashboardContent.includes('post.tags'), 'Dashboard must render post.tags');
    recordPass('9. Post metadata rendered', 'Title, excerpt, formatted date, and tag pills displayed');
  } catch (err) {
    recordFail('9. Post metadata rendered', err);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Post title navigation logic
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      dashboardContent.includes('to={`/post/${post.slug}`}'),
      'Published posts link to /post/:slug'
    );
    assert.ok(
      dashboardContent.includes('to={`/editor/${post._id}`}'),
      'Draft posts link directly to editor /editor/:id'
    );
    recordPass('10. Context-aware post title navigation', 'Published stories link to reader; drafts link directly to editor');
  } catch (err) {
    recordFail('10. Context-aware post title navigation', err);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Edit button links to /editor/:id
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      dashboardContent.includes('to={`/editor/${post._id}`}'),
      'Edit button must link to /editor/:id'
    );
    assert.ok(
      dashboardContent.includes('Edit'),
      'Edit button label present'
    );
    recordPass('11. Edit button links to /editor/:id', 'Edit button routes to specific post editor');
  } catch (err) {
    recordFail('11. Edit button links to /editor/:id', err);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Delete button calls confirmation prompt
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      dashboardContent.includes('window.confirm'),
      'Dashboard deletion must invoke user confirmation prompt'
    );
    recordPass('12. Delete button prompts for confirmation', 'Accidental deletions guarded by confirmation dialog');
  } catch (err) {
    recordFail('12. Delete button prompts for confirmation', err);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Delete handler calls DELETE /api/posts/:id
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      /api\s*\.\s*delete\(\s*`\/posts\/\$\{postId\}`\s*\)/.test(dashboardContent),
      'handleDelete must call api.delete(/posts/:postId)'
    );
    recordPass('13. Delete handler calls DELETE /api/posts/:id', 'Authenticated API delete request triggered');
  } catch (err) {
    recordFail('13. Delete handler calls DELETE /api/posts/:id', err);
  }

  // -------------------------------------------------------------------------
  // TEST 14: Post removal from state without full page refresh
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      dashboardContent.includes('prev.filter((p) => p._id !== postId)'),
      'State filter must remove deleted post without page reload'
    );
    recordPass('14. Post removal without page refresh', 'React state optimistically updates post list');
  } catch (err) {
    recordFail('14. Post removal without page refresh', err);
  }

  // -------------------------------------------------------------------------
  // TEST 15: Deletion loading and disable guards
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      dashboardContent.includes('disabled={deletingId === post._id}'),
      'Delete button disabled while deletion is executing'
    );
    assert.ok(
      dashboardContent.includes("'Deleting...' : 'Delete'"),
      'Delete button displays in-flight state text'
    );
    recordPass('15. Deletion loading and disable guards', 'In-flight deletions disable the button and show loading label');
  } catch (err) {
    recordFail('15. Deletion loading and disable guards', err);
  }

  // -------------------------------------------------------------------------
  // TEST 16: Empty dashboard state renders call-to-action
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      dashboardContent.includes('empty-dashboard'),
      'Dashboard must include empty-dashboard container'
    );
    assert.ok(
      dashboardContent.includes('Write Your First Story'),
      'Dashboard empty state must render Write Your First Story CTA'
    );
    assert.ok(
      dashboardContent.includes('to="/editor/new"'),
      'CTA must link to /editor/new'
    );
    recordPass('16. Empty dashboard state renders call-to-action', 'First-time author empty state directs to /editor/new');
  } catch (err) {
    recordFail('16. Empty dashboard state renders call-to-action', err);
  }

  // -------------------------------------------------------------------------
  // TEST 17: Dashboard loading and error states
  // -------------------------------------------------------------------------
  try {
    assert.ok(dashboardContent.includes('loading &&'), 'Dashboard handles loading state');
    assert.ok(dashboardContent.includes('error &&'), 'Dashboard handles fetch error state');
    assert.ok(dashboardContent.includes('deleteError &&'), 'Dashboard handles deletion error state');
    recordPass('17. Dashboard loading and error states', 'Distinct UI feedback for fetch loading, fetch error, and delete failure');
  } catch (err) {
    recordFail('17. Dashboard loading and error states', err);
  }

  // -------------------------------------------------------------------------
  // TEST 18: New story button in header
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      dashboardContent.includes('Write New Story'),
      'Header includes Write New Story button'
    );
    assert.ok(
      dashboardContent.includes('to="/editor/new"'),
      'Header button links to /editor/new'
    );
    recordPass('18. Header includes Write New Story button', 'Persistent navigation to article creation');
  } catch (err) {
    recordFail('18. Header includes Write New Story button', err);
  }

  // -------------------------------------------------------------------------
  // TEST 19: Public routes and existing application integrity
  // -------------------------------------------------------------------------
  try {
    assert.ok(appContent.includes('path="/" element={<Home />} />'), 'Public Home route remains accessible');
    assert.ok(appContent.includes('path="/post/:slug" element={<PostDetail />} />'), 'Public PostDetail route remains accessible');
    recordPass('19. Public routes and existing application integrity', 'Home and PostDetail routes remain public and unobstructed');
  } catch (err) {
    recordFail('19. Public routes and existing application integrity', err);
  }

  console.log(`\n==================================================`);
  console.log(`DAY 11 TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.length === 0 || results.some((r) => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

runDay11Verification();

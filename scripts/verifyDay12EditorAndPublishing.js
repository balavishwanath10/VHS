import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidHttpUrl } from '../src/utils/markdownParser.js';

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

async function runDay12Verification() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 12 Markdown Editor, Live Preview & Publishing Verification`);
  console.log(`==================================================\n`);

  const editorContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Editor.jsx'), 'utf8');
  const appContent = fs.readFileSync(path.resolve(rootDir, 'src', 'App.jsx'), 'utf8');

  // -------------------------------------------------------------------------
  // TEST 1: Editor renders title input
  // -------------------------------------------------------------------------
  try {
    assert.ok(editorContent.includes('id="editor-title"'), 'Editor must render title input with id');
    assert.ok(editorContent.includes('value={title}'), 'Title input must bind to title state');
    assert.ok(editorContent.includes('onChange={(e) => setTitle(e.target.value)}'), 'Title input must update title state');
    recordPass('1. Editor renders title input', 'Title input bound to title state with change handler');
  } catch (err) {
    recordFail('1. Editor renders title input', err);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Editor renders Markdown content textarea
  // -------------------------------------------------------------------------
  try {
    assert.ok(editorContent.includes('id="editor-content"'), 'Editor must render content textarea with id');
    assert.ok(editorContent.includes('value={content}'), 'Textarea must bind to content state');
    assert.ok(editorContent.includes('onChange={(e) => setContent(e.target.value)}'), 'Textarea must update content state');
    recordPass('2. Editor renders Markdown content textarea', 'Content textarea bound to content state');
  } catch (err) {
    recordFail('2. Editor renders Markdown content textarea', err);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Live preview integrates MarkdownRenderer
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes('import MarkdownRenderer from'),
      'Editor must import MarkdownRenderer component'
    );
    assert.ok(
      editorContent.includes('<MarkdownRenderer'),
      'Editor must render MarkdownRenderer component'
    );
    assert.ok(
      editorContent.includes('content={content'),
      'MarkdownRenderer must receive editor content'
    );
    recordPass('3. Live preview integrates MarkdownRenderer', 'Reusable MarkdownRenderer embedded in live preview container');
  } catch (err) {
    recordFail('3. Live preview integrates MarkdownRenderer', err);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Tab controls switch between Write and Live Preview
  // -------------------------------------------------------------------------
  try {
    assert.ok(editorContent.includes("activeTab === 'write'"), 'Editor supports write active tab');
    assert.ok(editorContent.includes("activeTab === 'preview'"), 'Editor supports preview active tab');
    assert.ok(editorContent.includes("setActiveTab('write')"), 'Write tab switch handler present');
    assert.ok(editorContent.includes("setActiveTab('preview')"), 'Preview tab switch handler present');
    recordPass('4. Tab controls switch between Write and Preview', 'Interactive tab switching between authoring and live preview');
  } catch (err) {
    recordFail('4. Tab controls switch between Write and Preview', err);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Tag selector loads available tags from backend
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      /api\s*\.\s*get\(\s*['"]\/tags['"]\s*\)/.test(editorContent),
      'Editor must call api.get(/tags)'
    );
    assert.ok(
      editorContent.includes('setAvailableTags(res.data.tags'),
      'Editor must store loaded tags in availableTags state'
    );
    recordPass('5. Tag selector loads available tags from backend', 'Editor fetches tags from GET /api/tags');
  } catch (err) {
    recordFail('5. Tag selector loads available tags from backend', err);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Tag selector allows selecting and deselecting tags
  // -------------------------------------------------------------------------
  try {
    assert.ok(editorContent.includes('handleTagToggle'), 'Editor defines handleTagToggle');
    assert.ok(
      editorContent.includes('prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]'),
      'handleTagToggle correctly toggles tag selection'
    );
    recordPass('6. Tag selector allows selecting and deselecting tags', 'Multi-select tag toggle updates selectedTags state');
  } catch (err) {
    recordFail('6. Tag selector allows selecting and deselecting tags', err);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Cover image URL input accepts and binds URL
  // -------------------------------------------------------------------------
  try {
    assert.ok(editorContent.includes('id="editor-cover"'), 'Editor renders cover image input');
    assert.ok(editorContent.includes('value={coverImage}'), 'Cover input binds to coverImage state');
    assert.ok(editorContent.includes('onChange={(e) => setCoverImage(e.target.value)}'), 'Cover input updates state');
    recordPass('7. Cover image URL input accepts and binds URL', 'Cover image input properly bound to component state');
  } catch (err) {
    recordFail('7. Cover image URL input accepts and binds URL', err);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Cover image URL validation helper works correctly
  // -------------------------------------------------------------------------
  try {
    assert.strictEqual(isValidHttpUrl('https://example.com/banner.png'), true);
    assert.strictEqual(isValidHttpUrl('http://example.com/photo.jpg'), true);
    assert.strictEqual(isValidHttpUrl('javascript:alert(1)'), false);
    assert.strictEqual(isValidHttpUrl('ftp://example.com/file.txt'), false);
    assert.strictEqual(isValidHttpUrl('invalid-url-string'), false);
    assert.strictEqual(isValidHttpUrl(''), false);
    assert.strictEqual(isValidHttpUrl(null), false);
    recordPass('8. Cover image URL validation works correctly', 'HTTP/HTTPS URLs validated and dangerous/invalid schemes rejected');
  } catch (err) {
    recordFail('8. Cover image URL validation works correctly', err);
  }

  // -------------------------------------------------------------------------
  // TEST 9: "Save Draft" sends post with status: 'draft'
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes("onClick={() => handleSave('draft')}"),
      'Save Draft button invokes handleSave with draft'
    );
    assert.ok(
      editorContent.includes("status: targetStatus"),
      'Payload assigns status to targetStatus'
    );
    recordPass('9. Save Draft sends post with status: draft', 'Draft action dispatches draft status in API payload');
  } catch (err) {
    recordFail('9. Save Draft sends post with status: draft', err);
  }

  // -------------------------------------------------------------------------
  // TEST 10: "Publish" sends post with status: 'published'
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes("onClick={() => handleSave('published')}"),
      'Publish button invokes handleSave with published'
    );
    recordPass('10. Publish sends post with status: published', 'Publish action dispatches published status in API payload');
  } catch (err) {
    recordFail('10. Publish sends post with status: published', err);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Missing title shows validation error
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes("!title || !title.trim()"),
      'handleSave checks title presence'
    );
    assert.ok(
      editorContent.includes("setError('Title is required')"),
      'Missing title triggers validation error'
    );
    recordPass('11. Missing title shows validation error', 'Empty title halts submission and sets error banner');
  } catch (err) {
    recordFail('11. Missing title shows validation error', err);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Missing content shows validation error on publish
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes("targetStatus === 'published' && (!content || !content.trim())"),
      'handleSave checks content presence when publishing'
    );
    assert.ok(
      editorContent.includes("setError('Content is required to publish a story')"),
      'Missing content triggers validation error on publish'
    );
    recordPass('12. Missing content shows validation error on publish', 'Publishing requires non-empty content');
  } catch (err) {
    recordFail('12. Missing content shows validation error on publish', err);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Invalid cover image URL shows validation error
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes('!isValidHttpUrl(coverImage.trim())'),
      'handleSave validates cover image URL format'
    );
    assert.ok(
      editorContent.includes("setError('Cover image must be a valid HTTP or HTTPS URL')"),
      'Invalid cover URL sets specific error message'
    );
    recordPass('13. Invalid cover image URL shows validation error', 'Malformed cover URL rejected with user error');
  } catch (err) {
    recordFail('13. Invalid cover image URL shows validation error', err);
  }

  // -------------------------------------------------------------------------
  // TEST 14: Successful publish navigates to post reader
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes("navigate(`/post/${savedPost.slug}`)"),
      'Successful publish navigates to /post/:slug'
    );
    recordPass('14. Successful publish navigates to post reader', 'Published article routes directly to public reader page');
  } catch (err) {
    recordFail('14. Successful publish navigates to post reader', err);
  }

  // -------------------------------------------------------------------------
  // TEST 15: Successful draft save navigates to dashboard
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes("navigate('/dashboard')"),
      'Draft save navigates to /dashboard'
    );
    recordPass('15. Successful draft save navigates to dashboard', 'Draft creation routes author back to dashboard');
  } catch (err) {
    recordFail('15. Successful draft save navigates to dashboard', err);
  }

  // -------------------------------------------------------------------------
  // TEST 16: Edit mode loads existing post by ID/slug and populates fields
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes("const isEditing = Boolean(id && id !== 'new')"),
      'Editor identifies edit mode when id is present'
    );
    assert.ok(
      /api\s*\.\s*get\(\s*`\/posts\/\$\{id\}`\s*\)/.test(editorContent),
      'Edit mode calls GET /api/posts/:id'
    );
    assert.ok(editorContent.includes('setTitle(post.title ||'), 'Edit mode populates title');
    assert.ok(editorContent.includes('setContent(post.content ||'), 'Edit mode populates content');
    assert.ok(editorContent.includes('setCoverImage(post.coverImage ||'), 'Edit mode populates coverImage');
    assert.ok(editorContent.includes('setSelectedTags('), 'Edit mode populates selectedTags');
    recordPass('16. Edit mode loads existing post and populates fields', 'Existing post data retrieved and fields initialized');
  } catch (err) {
    recordFail('16. Edit mode loads existing post and populates fields', err);
  }

  // -------------------------------------------------------------------------
  // TEST 17: Edit mode updates post via PUT /api/posts/:id
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      /api\s*\.\s*put\(\s*`\/posts\/\$\{id\}`\s*,\s*payload\s*\)/.test(editorContent),
      'Edit mode updates post via api.put(/posts/:id, payload)'
    );
    recordPass('17. Edit mode updates post via PUT /api/posts/:id', 'Edit updates dispatch PUT request');
  } catch (err) {
    recordFail('17. Edit mode updates post via PUT /api/posts/:id', err);
  }

  // -------------------------------------------------------------------------
  // TEST 18: Create mode creates post via POST /api/posts
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      /api\s*\.\s*post\(\s*['"]\/posts['"]\s*,\s*payload\s*\)/.test(editorContent),
      'Create mode creates post via api.post(/posts, payload)'
    );
    recordPass('18. Create mode creates post via POST /api/posts', 'New post creation dispatches POST request');
  } catch (err) {
    recordFail('18. Create mode creates post via POST /api/posts', err);
  }

  // -------------------------------------------------------------------------
  // TEST 19: Submit buttons disabled during submission
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      editorContent.includes('disabled={submitting}'),
      'Buttons and inputs guarded by submitting state'
    );
    assert.ok(
      editorContent.includes("'Publishing...'") && editorContent.includes("'Publish'"),
      'Publish button shows in-flight publishing label'
    );
    assert.ok(
      editorContent.includes("'Saving...'") && editorContent.includes("'Save Draft'"),
      'Save Draft button shows in-flight saving label'
    );
    recordPass('19. Submit buttons disabled during submission', 'Prevent duplicate submissions and show loading labels');
  } catch (err) {
    recordFail('19. Submit buttons disabled during submission', err);
  }

  // -------------------------------------------------------------------------
  // TEST 20: Unauthenticated access to editor is blocked by ProtectedRoute
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      /path="\/editor\/new"[\s\S]*?<ProtectedRoute>/.test(appContent),
      '/editor/new must be wrapped in <ProtectedRoute>'
    );
    assert.ok(
      /path="\/editor\/:id"[\s\S]*?<ProtectedRoute>/.test(appContent),
      '/editor/:id must be wrapped in <ProtectedRoute>'
    );
    recordPass('20. Unauthenticated access to editor is blocked by ProtectedRoute', 'Both new and edit editor routes guarded by ProtectedRoute');
  } catch (err) {
    recordFail('20. Unauthenticated access to editor is blocked by ProtectedRoute', err);
  }

  // -------------------------------------------------------------------------
  // TEST 21: Existing routes and features continue functioning
  // -------------------------------------------------------------------------
  try {
    assert.ok(appContent.includes('path="/" element={<Home />} />'), 'Public Home route remains accessible');
    assert.ok(appContent.includes('path="/post/:slug" element={<PostDetail />} />'), 'Public PostDetail route remains accessible');
    assert.ok(appContent.includes('path="/dashboard"'), 'Dashboard route remains accessible');
    recordPass('21. Existing routes and features continue functioning', 'All core routing and previous features preserved');
  } catch (err) {
    recordFail('21. Existing routes and features continue functioning', err);
  }

  console.log(`\n==================================================`);
  console.log(`DAY 12 TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.length === 0 || results.some((r) => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

runDay12Verification();

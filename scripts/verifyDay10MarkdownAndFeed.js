import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sanitizeUrl,
  tokenizeCodeLine,
  parseInlineTokens,
  parseMarkdownBlocks,
} from '../src/utils/markdownParser.js';

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

async function runDay10Verification() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 10 Public Feed & Markdown Post Reader Verification`);
  console.log(`==================================================\n`);

  // -------------------------------------------------------------------------
  // TEST 1: Feed component fetches published posts from API
  // -------------------------------------------------------------------------
  try {
    const homeContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Home.jsx'), 'utf8');
    assert.ok(/api\s*\.\s*get\(\s*['"]\/posts['"]\s*\)/.test(homeContent), 'Home.jsx must call api.get(/posts)');
    assert.ok(homeContent.includes('setPosts(res.data.posts'), 'Home.jsx must update state with res.data.posts');
    recordPass('1. Feed fetches published posts', 'Home component calls GET /api/posts and stores posts in state');
  } catch (err) {
    recordFail('1. Feed fetches published posts', err);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Post cards render title & excerpt
  // -------------------------------------------------------------------------
  try {
    const homeContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Home.jsx'), 'utf8');
    assert.ok(homeContent.includes('{post.title}'), 'Home.jsx must render post.title');
    assert.ok(homeContent.includes('{post.excerpt}'), 'Home.jsx must render post.excerpt');
    recordPass('2. Post cards render title & excerpt', 'Post cards render title and excerpt bindings');
  } catch (err) {
    recordFail('2. Post cards render title & excerpt', err);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Author & date display
  // -------------------------------------------------------------------------
  try {
    const homeContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Home.jsx'), 'utf8');
    assert.ok(homeContent.includes('post.author?.name'), 'Home.jsx must render author name or fallback');
    assert.ok(homeContent.includes('post.author?.avatarUrl'), 'Home.jsx must check author avatar');
    assert.ok(homeContent.includes('post.createdAt'), 'Home.jsx must format post publication date');
    recordPass('3. Author & date display', 'Post card displays author identity, avatar fallback, and creation date');
  } catch (err) {
    recordFail('3. Author & date display', err);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Cover image displays when present; missing cover image does not break card
  // -------------------------------------------------------------------------
  try {
    const homeContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Home.jsx'), 'utf8');
    assert.ok(homeContent.includes('{post.coverImage &&'), 'Home.jsx must conditionally render coverImage container');
    assert.ok(homeContent.includes('alt={post.title}'), 'Cover image must have alt text');
    recordPass('4. Cover image displays when present; missing cover image does not break card', 'Cover image is conditionally rendered with alt text');
  } catch (err) {
    recordFail('4. Cover image displays when present; missing cover image does not break card', err);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Tags render and link correctly
  // -------------------------------------------------------------------------
  try {
    const homeContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Home.jsx'), 'utf8');
    assert.ok(homeContent.includes('to={`/tag/${tag.slug}`}'), 'Tags must link to /tag/:slug');
    assert.ok(homeContent.includes('#{tag.name}'), 'Tags must display with hash prefix');
    recordPass('5. Tags render and link correctly', 'Tag pills link to tag route with hash-prefixed name');
  } catch (err) {
    recordFail('5. Tags render and link correctly', err);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Post card navigates to detail route
  // -------------------------------------------------------------------------
  try {
    const homeContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Home.jsx'), 'utf8');
    assert.ok(homeContent.includes('to={`/post/${post.slug}`}'), 'Post card title/cover must link to /post/:slug');
    recordPass('6. Post card navigates to detail route', 'Card title and cover navigate to /post/:slug');
  } catch (err) {
    recordFail('6. Post card navigates to detail route', err);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Feed loading, empty, and error states
  // -------------------------------------------------------------------------
  try {
    const homeContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Home.jsx'), 'utf8');
    assert.ok(homeContent.includes('loading &&'), 'Home.jsx must render loading state');
    assert.ok(homeContent.includes('error &&'), 'Home.jsx must render error state');
    assert.ok(homeContent.includes('posts.length === 0'), 'Home.jsx must render empty feed state');
    assert.ok(homeContent.includes('empty-feed'), 'Home.jsx must include empty-feed class card');
    recordPass('7. Feed loading, empty, and error states', 'Feed includes distinct loading, empty, and error branches');
  } catch (err) {
    recordFail('7. Feed loading, empty, and error states', err);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Post detail fetches correct slug
  // -------------------------------------------------------------------------
  try {
    const postDetailContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'PostDetail.jsx'), 'utf8');
    assert.ok(postDetailContent.includes('const { slug } = useParams()'), 'PostDetail must extract slug param');
    assert.ok(/api\s*\.\s*get\(\s*`\/posts\/\$\{slug\}`\s*\)/.test(postDetailContent), 'PostDetail must fetch GET /api/posts/:slug');
    recordPass('8. Post detail fetches correct slug', 'PostDetail uses URL slug param to fetch post content');
  } catch (err) {
    recordFail('8. Post detail fetches correct slug', err);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Post title & metadata render
  // -------------------------------------------------------------------------
  try {
    const postDetailContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'PostDetail.jsx'), 'utf8');
    assert.ok(postDetailContent.includes('{post.title}'), 'PostDetail must render post title');
    assert.ok(postDetailContent.includes('post.author?.name'), 'PostDetail must render author name');
    assert.ok(postDetailContent.includes('post.createdAt'), 'PostDetail must render publication date');
    assert.ok(postDetailContent.includes('MarkdownRenderer content={post.content}'), 'PostDetail must pass content to MarkdownRenderer');
    recordPass('9. Post title & metadata render', 'PostDetail renders title, author, date, and Markdown content');
  } catch (err) {
    recordFail('9. Post title & metadata render', err);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Markdown headings & paragraphs render
  // -------------------------------------------------------------------------
  try {
    const sampleMarkdown = `# Top Heading\n\nThis is a paragraph with **bold** text and *italic* text.\n\n### Subheading 3\n\nAnother paragraph.`;
    const blocks = parseMarkdownBlocks(sampleMarkdown);

    assert.strictEqual(blocks[0].type, 'heading');
    assert.strictEqual(blocks[0].level, 1);
    assert.strictEqual(blocks[0].text, 'Top Heading');

    assert.strictEqual(blocks[1].type, 'paragraph');
    assert.ok(blocks[1].text.includes('bold'));

    assert.strictEqual(blocks[2].type, 'heading');
    assert.strictEqual(blocks[2].level, 3);
    assert.strictEqual(blocks[2].text, 'Subheading 3');

    assert.strictEqual(blocks[3].type, 'paragraph');

    // Test inline parsing
    const inlineTokens = parseInlineTokens('Hello **world** and *developers* and `code`');
    assert.ok(inlineTokens.some((t) => t.type === 'bold' && t.content === 'world'));
    assert.ok(inlineTokens.some((t) => t.type === 'italic' && t.content === 'developers'));
    assert.ok(inlineTokens.some((t) => t.type === 'code' && t.content === 'code'));

    recordPass('10. Markdown headings & paragraphs render', 'Markdown parser correctly produces AST blocks for headings, paragraphs, and inline formatting');
  } catch (err) {
    recordFail('10. Markdown headings & paragraphs render', err);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Markdown lists & blockquotes render
  // -------------------------------------------------------------------------
  try {
    const listMd = `- Item One\n- Item Two\n- Item Three\n\n> This is a famous developer quote.\n\n1. First step\n2. Second step`;
    const blocks = parseMarkdownBlocks(listMd);

    assert.strictEqual(blocks[0].type, 'ul');
    assert.strictEqual(blocks[0].items.length, 3);
    assert.strictEqual(blocks[0].items[0], 'Item One');

    assert.strictEqual(blocks[1].type, 'blockquote');
    assert.strictEqual(blocks[1].lines[0], 'This is a famous developer quote.');

    assert.strictEqual(blocks[2].type, 'ol');
    assert.strictEqual(blocks[2].items.length, 2);
    assert.strictEqual(blocks[2].items[0], 'First step');

    recordPass('11. Markdown lists & blockquotes render', 'Unordered lists, ordered lists, and blockquotes parsed accurately');
  } catch (err) {
    recordFail('11. Markdown lists & blockquotes render', err);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Code blocks render with syntax highlighting
  // -------------------------------------------------------------------------
  try {
    const codeMd = "```javascript\nconst greeting = 'Hello, VHS!';\n// Print greeting\nconsole.log(greeting, 42);\n```";
    const blocks = parseMarkdownBlocks(codeMd);

    assert.strictEqual(blocks[0].type, 'codeblock');
    assert.strictEqual(blocks[0].lang, 'javascript');
    assert.ok(blocks[0].code.includes('greeting'));

    const tokens = tokenizeCodeLine("const greeting = 'Hello, VHS!'; // Comment");
    assert.ok(tokens.some((t) => t.type === 'keyword' && t.text === 'const'), 'Keyword const must be tokenized');
    assert.ok(tokens.some((t) => t.type === 'string' && t.text === "'Hello, VHS!'"), 'String literal must be tokenized');
    assert.ok(tokens.some((t) => t.type === 'comment' && t.text === '// Comment'), 'Comment must be tokenized');

    const numTokens = tokenizeCodeLine('const port = 5000;');
    assert.ok(numTokens.some((t) => t.type === 'number' && t.text === '5000'), 'Numeric literal 5000 must be tokenized');

    recordPass('12. Code blocks render with syntax highlighting', 'Code fences captured with language and tokenized for keywords, strings, comments, numbers');
  } catch (err) {
    recordFail('12. Code blocks render with syntax highlighting', err);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Unsafe HTML / script injection prevented
  // -------------------------------------------------------------------------
  try {
    const rendererContent = fs.readFileSync(path.resolve(rootDir, 'src', 'components', 'MarkdownRenderer.jsx'), 'utf8');
    assert.strictEqual(/dangerouslySetInnerHTML\s*=/.test(rendererContent), false, 'MarkdownRenderer MUST NOT use dangerouslySetInnerHTML');

    // Ensure raw script tag is treated as plain text tokens
    const maliciousInput = "<script>alert('XSS')</script>";
    const tokens = parseInlineTokens(maliciousInput);
    assert.ok(tokens.length > 0);
    assert.ok(tokens.every((t) => t.type === 'text'), 'Raw HTML must be parsed as plain text tokens, never executable HTML nodes');
    assert.strictEqual(tokens[0].content, maliciousInput);

    recordPass('13. Unsafe HTML / script injection prevented', 'Zero dangerouslySetInnerHTML and raw HTML tags parsed as plain text strings');
  } catch (err) {
    recordFail('13. Unsafe HTML / script injection prevented', err);
  }

  // -------------------------------------------------------------------------
  // TEST 14: Unsafe URL schemes rejected
  // -------------------------------------------------------------------------
  try {
    assert.strictEqual(sanitizeUrl("javascript:alert('XSS')"), '#', 'javascript: must be sanitized to #');
    assert.strictEqual(sanitizeUrl("JavaScript:alert(1)"), '#', 'Case-insensitive JavaScript: must be sanitized to #');
    assert.strictEqual(sanitizeUrl("data:text/html,<script>alert(1)</script>"), '#', 'data: URLs must be sanitized to #');
    assert.strictEqual(sanitizeUrl("vbscript:MsgBox(1)"), '#', 'vbscript: must be sanitized to #');
    assert.strictEqual(sanitizeUrl("file:///etc/passwd"), '#', 'file: protocol must be sanitized to #');
    assert.strictEqual(sanitizeUrl("https://example.com"), 'https://example.com', 'https: URLs must be permitted');
    assert.strictEqual(sanitizeUrl("/post/my-post"), '/post/my-post', 'Relative URLs must be permitted');

    recordPass('14. Unsafe URL schemes (javascript:, data:) rejected', 'Malicious protocols (javascript, data, vbscript, file) sanitized to #');
  } catch (err) {
    recordFail('14. Unsafe URL schemes (javascript:, data:) rejected', err);
  }

  // -------------------------------------------------------------------------
  // TEST 15: Missing post displays 404 state
  // -------------------------------------------------------------------------
  try {
    const postDetailContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'PostDetail.jsx'), 'utf8');
    assert.ok(postDetailContent.includes('notFound'), 'PostDetail must maintain notFound state');
    assert.ok(postDetailContent.includes('404 — Story Not Found'), 'PostDetail must render 404 message');
    assert.ok(postDetailContent.includes('Back to Home Feed'), 'PostDetail must provide link back to home');
    recordPass('15. Missing post displays 404 state', 'PostDetail renders clear 404 UI when post is missing or unpublished');
  } catch (err) {
    recordFail('15. Missing post displays 404 state', err);
  }

  // -------------------------------------------------------------------------
  // TEST 16: Existing routes and authentication continue passing
  // -------------------------------------------------------------------------
  try {
    const appContent = fs.readFileSync(path.resolve(rootDir, 'src', 'App.jsx'), 'utf8');
    assert.ok(appContent.includes('path="/"'), 'Home route exists in App.jsx');
    assert.ok(appContent.includes('path="/post/:slug"'), 'Post detail route exists in App.jsx');
    assert.ok(appContent.includes('path="/login"'), 'Login route exists in App.jsx');
    assert.ok(appContent.includes('path="/register"'), 'Register route exists in App.jsx');
    assert.ok(appContent.includes('AuthProvider'), 'AuthProvider wraps routes');
    recordPass('16. Existing routes and authentication continue passing', 'All core routing and auth contexts preserved');
  } catch (err) {
    recordFail('16. Existing routes and authentication continue passing', err);
  }

  console.log(`\n==================================================`);
  console.log(`DAY 10 TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.length === 0 || results.some((r) => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

runDay10Verification();

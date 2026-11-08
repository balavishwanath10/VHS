/**
 * VHS Day 17 Automated Verification Script
 * Covers: UI Quality, Responsiveness, Accessibility & Markdown Safety
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Import markdown parser and sanitizer
import {
  sanitizeUrl,
  isValidHttpUrl,
  tokenizeCodeLine,
  parseInlineTokens,
  parseMarkdownBlocks,
} from '../src/utils/markdownParser.js';

console.log('\n==================================================');
console.log('VHS Day 17 UI Quality, Responsiveness & Markdown Safety');
console.log('==================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// Part 1: Responsive Layout & CSS Configuration
// -------------------------------------------------------------
console.log('--- Phase 1: Responsive CSS & Layout Configuration ---');

const cssContent = fs.readFileSync(path.join(rootDir, 'src', 'index.css'), 'utf-8');

runTest('1. CSS includes mobile and tablet media queries (768px, 640px, 360px)', () => {
  assert.ok(cssContent.includes('@media (max-width: 768px)'), 'Missing 768px tablet media query');
  assert.ok(cssContent.includes('@media (max-width: 640px)'), 'Missing 640px mobile media query');
  assert.ok(cssContent.includes('@media (max-width: 360px)'), 'Missing 360px small mobile media query');
});

runTest('2. Universal horizontal overflow protection is enabled', () => {
  assert.ok(cssContent.includes('overflow-x: hidden'), 'Missing overflow-x hidden on root/body');
  assert.ok(cssContent.includes('overflow-wrap: break-word'), 'Missing overflow-wrap break-word for text wrapping');
});

runTest('3. Navbar responsive flex-wrap and mobile view adjustments', () => {
  assert.ok(cssContent.includes('.nav-container'), 'Missing .nav-container rule');
  assert.ok(cssContent.includes('.nav-username'), 'Missing .nav-username responsive rule');
});

runTest('4. Dashboard responsive column stacking for mobile viewports', () => {
  assert.ok(cssContent.includes('.dashboard-post-card'), 'Missing .dashboard-post-card styles');
  assert.ok(cssContent.includes('.dashboard-post-controls'), 'Missing .dashboard-post-controls responsive rule');
});

runTest('5. Profile layout stacks vertically on mobile viewports', () => {
  assert.ok(cssContent.includes('.profile-header-layout'), 'Missing .profile-header-layout rule');
  assert.ok(cssContent.includes('flex-direction: column'), 'Missing flex-direction column on mobile profile');
});

// -------------------------------------------------------------
// Part 2: Accessibility & Usability
// -------------------------------------------------------------
console.log('\n--- Phase 2: Accessibility, Semantics & Usability ---');

runTest('6. Focus visible indicators for keyboard navigation', () => {
  assert.ok(cssContent.includes(':focus-visible'), 'Missing :focus-visible CSS rules');
  assert.ok(cssContent.includes('outline: 2px solid'), 'Missing visible focus ring');
});

const loginContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Login.jsx'), 'utf-8');
const registerContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Register.jsx'), 'utf-8');
const settingsContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Settings.jsx'), 'utf-8');
const editorContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Editor.jsx'), 'utf-8');
const postDetailContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'PostDetail.jsx'), 'utf-8');

runTest('7. Form inputs have associated accessible labels (htmlFor & id)', () => {
  assert.ok(loginContent.includes('htmlFor="email"') && loginContent.includes('id="email"'), 'Login email input missing label association');
  assert.ok(loginContent.includes('htmlFor="password"') && loginContent.includes('id="password"'), 'Login password input missing label association');
  assert.ok(registerContent.includes('htmlFor="name"') && registerContent.includes('id="name"'), 'Register name input missing label association');
  assert.ok(settingsContent.includes('htmlFor="settings-name"') && settingsContent.includes('id="settings-name"'), 'Settings name input missing label association');
  assert.ok(settingsContent.includes('htmlFor="settings-bio"') && settingsContent.includes('id="settings-bio"'), 'Settings bio input missing label association');
});

runTest('8. Image tags include alternative text attributes for screen readers', () => {
  const markdownRendererContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'MarkdownRenderer.jsx'), 'utf-8');
  assert.ok(markdownRendererContent.includes('alt={token.alt ||'), 'MarkdownRenderer image must have accessible alt fallback');
  assert.ok(markdownRendererContent.includes('loading="lazy"'), 'MarkdownRenderer image should use lazy loading');
});

runTest('9. Semantic HTML landmarks used across core pages', () => {
  assert.ok(postDetailContent.includes('<article'), 'PostDetail must use <article> semantic container');
  assert.ok(postDetailContent.includes('<header'), 'PostDetail must use <header> landmark');
  assert.ok(postDetailContent.includes('<section'), 'PostDetail must use <section> landmark');
});

// -------------------------------------------------------------
// Part 3: Markdown Parser & Security Verification
// -------------------------------------------------------------
console.log('\n--- Phase 3: Markdown Rendering Security Verification ---');

runTest('10. Block standard javascript: URI injection', () => {
  assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '#');
  assert.strictEqual(sanitizeUrl('JAVASCRIPT:alert(document.cookie)'), '#');
  assert.strictEqual(sanitizeUrl('  javascript:void(0)  '), '#');
});

runTest('11. Block obfuscated and control-character javascript: URIs', () => {
  assert.strictEqual(sanitizeUrl('java\0script:alert(1)'), '#');
  assert.strictEqual(sanitizeUrl('java\x01script:alert(1)'), '#');
  assert.strictEqual(sanitizeUrl('java script:alert(1)'), '#');
  assert.strictEqual(sanitizeUrl('\x1bjavascript:alert(1)'), '#');
});

runTest('12. Block data:, vbscript:, and file: dangerous URIs', () => {
  assert.strictEqual(sanitizeUrl('data:text/html;base64,PHNjcmlwdD4='), '#');
  assert.strictEqual(sanitizeUrl('DATA:image/svg+xml,...'), '#');
  assert.strictEqual(sanitizeUrl('vbscript:msgbox(1)'), '#');
  assert.strictEqual(sanitizeUrl('file:///etc/passwd'), '#');
  assert.strictEqual(sanitizeUrl('FILE://C:/Windows/win.ini'), '#');
});

runTest('13. Allow valid HTTP, HTTPS, and mailto URLs', () => {
  assert.strictEqual(sanitizeUrl('https://hashnode.com'), 'https://hashnode.com');
  assert.strictEqual(sanitizeUrl('http://localhost:5000/api'), 'http://localhost:5000/api');
  assert.strictEqual(sanitizeUrl('mailto:dev@example.com'), 'mailto:dev@example.com');
  assert.strictEqual(sanitizeUrl('/relative/path/to/post'), '/relative/path/to/post');
});

runTest('14. URL validation helper isValidHttpUrl works accurately', () => {
  assert.strictEqual(isValidHttpUrl('https://example.com/avatar.png'), true);
  assert.strictEqual(isValidHttpUrl('http://example.com'), true);
  assert.strictEqual(isValidHttpUrl('javascript:alert(1)'), false);
  assert.strictEqual(isValidHttpUrl('ftp://example.com'), false);
  assert.strictEqual(isValidHttpUrl('not a url'), false);
  assert.strictEqual(isValidHttpUrl(''), false);
});

runTest('15. Raw HTML and script tags are treated as safe text by React parser', () => {
  const blocks = parseMarkdownBlocks('<script>alert("XSS")</script>');
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0].type, 'paragraph');
  assert.strictEqual(blocks[0].text, '<script>alert("XSS")</script>');
  // Since MarkdownRenderer does not use dangerouslySetInnerHTML, React escapes <script> automatically
  const rendererFile = fs.readFileSync(path.join(rootDir, 'src', 'components', 'MarkdownRenderer.jsx'), 'utf-8');
  const codeWithoutComments = rendererFile.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  assert.ok(!codeWithoutComments.includes('dangerouslySetInnerHTML'), 'MarkdownRenderer MUST NOT use dangerouslySetInnerHTML');
});

runTest('16. Markdown block parser handles headings, codeblocks, blockquotes, and lists', () => {
  const md = `# Title
## Subtitle
> Important note

- Item 1
- Item 2

1. First
2. Second

\`\`\`javascript
const x = 42;
\`\`\``;

  const blocks = parseMarkdownBlocks(md);
  assert.strictEqual(blocks[0].type, 'heading');
  assert.strictEqual(blocks[0].level, 1);
  assert.strictEqual(blocks[1].type, 'heading');
  assert.strictEqual(blocks[1].level, 2);
  assert.strictEqual(blocks[2].type, 'blockquote');
  assert.strictEqual(blocks[3].type, 'ul');
  assert.strictEqual(blocks[4].type, 'ol');
  assert.strictEqual(blocks[5].type, 'codeblock');
  assert.strictEqual(blocks[5].lang, 'javascript');
});

runTest('17. Inline parser handles bold, italic, code, links, and images safely', () => {
  const text = 'Here is **bold**, *italic*, `code`, and a [link](https://example.com) with an ![alt text](https://example.com/img.png).';
  const tokens = parseInlineTokens(text);

  const boldTok = tokens.find((t) => t.type === 'bold');
  const italicTok = tokens.find((t) => t.type === 'italic');
  const codeTok = tokens.find((t) => t.type === 'code');
  const linkTok = tokens.find((t) => t.type === 'link');
  const imgTok = tokens.find((t) => t.type === 'image');

  assert.ok(boldTok && boldTok.content === 'bold', 'Bold token failed');
  assert.ok(italicTok && italicTok.content === 'italic', 'Italic token failed');
  assert.ok(codeTok && codeTok.content === 'code', 'Code token failed');
  assert.ok(linkTok && linkTok.text === 'link' && linkTok.url === 'https://example.com', 'Link token failed');
  assert.ok(imgTok && imgTok.alt === 'alt text' && imgTok.url === 'https://example.com/img.png', 'Image token failed');
});

runTest('18. Syntax highlighting tokenizer handles keywords, strings, comments, and numbers', () => {
  const line = 'const answer = 42; // comment';
  const tokens = tokenizeCodeLine(line);

  assert.ok(tokens.some((t) => t.type === 'keyword' && t.text === 'const'), 'Keyword not recognized');
  assert.ok(tokens.some((t) => t.type === 'number' && t.text === '42'), 'Number not recognized');
  assert.ok(tokens.some((t) => t.type === 'comment' && t.text === '// comment'), 'Comment not recognized');
});

// -------------------------------------------------------------
// Part 4: UI States Verification
// -------------------------------------------------------------
console.log('\n--- Phase 4: UI States Verification ---');

runTest('19. Home feed handles loading, error, and empty states', () => {
  const homeContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Home.jsx'), 'utf-8');
  assert.ok(homeContent.includes('feed-loading') || homeContent.includes('Loading stories'), 'Home missing loading state');
  assert.ok(homeContent.includes('alert-error'), 'Home missing error alert');
  assert.ok(homeContent.includes('empty-feed'), 'Home missing empty feed state');
});

runTest('20. PostDetail handles loading, 404, and error states', () => {
  assert.ok(postDetailContent.includes('Loading post'), 'PostDetail missing loading state');
  assert.ok(postDetailContent.includes('404 — Story Not Found'), 'PostDetail missing 404 state');
  assert.ok(postDetailContent.includes('alert-error'), 'PostDetail missing error alert');
});

runTest('21. Dashboard handles loading, empty, and post deletion states', () => {
  const dashContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'Dashboard.jsx'), 'utf-8');
  assert.ok(dashContent.includes('Loading your stories'), 'Dashboard missing loading state');
  assert.ok(dashContent.includes('empty-dashboard'), 'Dashboard missing empty state');
  assert.ok(dashContent.includes('window.confirm'), 'Dashboard missing delete confirmation');
});

console.log('\n==================================================');
console.log(`DAY 17 TEST SUMMARY: ${passCount}/${passCount + failCount} PASSED (${failCount} FAILED)`);
console.log('==================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

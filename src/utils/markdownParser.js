/**
 * Pure JavaScript Markdown Parser & URL Sanitizer for VHS
 * Zero external dependencies. Zero dangerouslySetInnerHTML.
 */

/**
 * Validates that a URL uses a safe protocol (http, https, mailto, or relative).
 * Strictly prevents javascript:, data:, and vbscript: execution.
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  // Strip control characters, null bytes, and non-printable characters for scheme inspection
  const stripped = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '');
  const lower = stripped.toLowerCase();

  // Block dangerous schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.includes('javascript:') ||
    lower.includes('vbscript:') ||
    lower.includes('data:text/html')
  ) {
    return '#';
  }

  return trimmed;
};

/**
 * Validates whether a string is a well-formed http or https URL.
 */
export const isValidHttpUrl = (str) => {
  if (!str || typeof str !== 'string') return false;
  try {
    const parsed = new URL(str.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

/**
 * Tokenizes a line of code into syntax highlighted tokens.
 */
export const tokenizeCodeLine = (line) => {
  if (!line && line !== '') return [];

  const tokens = [];
  // Pattern for comments, strings, keywords, numbers
  const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|import|export|from|class|extends|async|await|try|catch|finally|new|this|typeof|instanceof|def|None|True|False|true|false|null|undefined)\b)|(\b\d+(?:\.\d+)?\b)/g;

  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'plain',
        text: line.slice(lastIndex, match.index),
      });
    }

    if (match[1]) {
      tokens.push({ type: 'comment', text: match[1] });
    } else if (match[2]) {
      tokens.push({ type: 'string', text: match[2] });
    } else if (match[3]) {
      tokens.push({ type: 'keyword', text: match[3] });
    } else if (match[4]) {
      tokens.push({ type: 'number', text: match[4] });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({
      type: 'plain',
      text: line.slice(lastIndex),
    });
  }

  return tokens.length > 0 ? tokens : [{ type: 'plain', text: line }];
};

/**
 * Parses inline markdown tokens (bold, italic, strikethrough, code, links, images).
 */
export const parseInlineTokens = (text) => {
  if (!text || typeof text !== 'string') return [];

  const tokens = [];
  const inlineRegex = /(!\[([^\]]*)\]\(([^)]*)\))|(\[([^\]]+)\]\(([^)]*)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(~~([^~]+)~~)/g;

  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    if (match[1]) {
      // Image: ![alt](url)
      tokens.push({
        type: 'image',
        alt: match[2],
        url: sanitizeUrl(match[3]),
      });
    } else if (match[4]) {
      // Link: [text](url)
      tokens.push({
        type: 'link',
        text: match[5],
        url: sanitizeUrl(match[6]),
      });
    } else if (match[7]) {
      // Inline code: `code`
      tokens.push({
        type: 'code',
        content: match[8],
      });
    } else if (match[9]) {
      // Bold: **text**
      tokens.push({
        type: 'bold',
        content: match[10],
      });
    } else if (match[11]) {
      // Italic: *text*
      tokens.push({
        type: 'italic',
        content: match[12],
      });
    } else if (match[13]) {
      // Strikethrough: ~~text~~
      tokens.push({
        type: 'strikethrough',
        content: match[14],
      });
    }

    lastIndex = inlineRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', content: text }];
};

/**
 * Parses markdown source into block-level AST items.
 */
export const parseMarkdownBlocks = (content) => {
  if (!content || typeof content !== 'string') return [];

  const blocks = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: 'codeblock',
        lang,
        code: codeLines.join('\n'),
        lines: codeLines,
      });
      continue;
    }

    // Headings: # H1 through ###### H6
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // Horizontal Rule
    if (/^(?:[-*_]\s*){3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blockquote: > quote
    if (line.trim().startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        lines: quoteLines,
      });
      continue;
    }

    // Unordered List: - item or * item
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'ul',
        items,
      });
      continue;
    }

    // Ordered List: 1. item
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'ol',
        items,
      });
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    const paragraphLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(?:[-*_]\s*){3,}$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join(' '),
    });
  }

  return blocks;
};

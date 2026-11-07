import React from 'react';
import {
  sanitizeUrl,
  tokenizeCodeLine,
  parseInlineTokens,
  parseMarkdownBlocks,
} from '../utils/markdownParser.js';

export { sanitizeUrl, tokenizeCodeLine, parseInlineTokens, parseMarkdownBlocks };

/**
 * Renders inline markdown tokens to React elements.
 */
export const renderInlineTokens = (tokens) => {
  return tokens.map((token, idx) => {
    switch (token.type) {
      case 'text':
        return token.content;
      case 'bold':
        return <strong key={`b-${idx}`}>{token.content}</strong>;
      case 'italic':
        return <em key={`i-${idx}`}>{token.content}</em>;
      case 'strikethrough':
        return <del key={`d-${idx}`}>{token.content}</del>;
      case 'code':
        return (
          <code key={`c-${idx}`} className="inline-code">
            {token.content}
          </code>
        );
      case 'link':
        return (
          <a
            key={`a-${idx}`}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            className="markdown-link"
          >
            {token.text}
          </a>
        );
      case 'image':
        return (
          <img
            key={`img-${idx}`}
            src={token.url}
            alt={token.alt}
            className="markdown-img"
          />
        );
      default:
        return token.content || '';
    }
  });
};

/**
 * Highlights a block of code line by line with tokens.
 */
export const highlightCode = (code) => {
  if (!code) return [];
  const lines = code.split('\n');

  return lines.map((line, lineIdx) => {
    const tokens = tokenizeCodeLine(line);
    return (
      <div key={`line-${lineIdx}`} className="code-line">
        {tokens.map((tok, tokIdx) => {
          if (tok.type === 'plain') {
            return <span key={`t-${tokIdx}`}>{tok.text}</span>;
          }
          return (
            <span key={`t-${tokIdx}`} className={`tok-${tok.type}`}>
              {tok.text}
            </span>
          );
        })}
      </div>
    );
  });
};

/**
 * Safe, zero-dependency MarkdownRenderer component for VHS.
 * Completely eliminates dangerouslySetInnerHTML and guarantees XSS safety.
 */
export const MarkdownRenderer = ({ content }) => {
  if (!content || typeof content !== 'string') {
    return <div className="markdown-content empty" />;
  }

  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="markdown-content">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const HeadingTag = `h${block.level}`;
            const inlineTokens = parseInlineTokens(block.text);
            return (
              <HeadingTag
                key={`h-${idx}`}
                className={`markdown-h${block.level}`}
              >
                {renderInlineTokens(inlineTokens)}
              </HeadingTag>
            );
          }
          case 'paragraph': {
            const inlineTokens = parseInlineTokens(block.text);
            return (
              <p key={`p-${idx}`} className="markdown-paragraph">
                {renderInlineTokens(inlineTokens)}
              </p>
            );
          }
          case 'codeblock': {
            return (
              <div key={`cb-${idx}`} className="code-block-wrapper">
                {block.lang && (
                  <div className="code-lang-tag">{block.lang}</div>
                )}
                <pre className="code-block">
                  <code>{highlightCode(block.code)}</code>
                </pre>
              </div>
            );
          }
          case 'blockquote': {
            return (
              <blockquote key={`bq-${idx}`} className="markdown-quote">
                {block.lines.map((line, qIdx) => (
                  <p key={`bqp-${qIdx}`}>
                    {renderInlineTokens(parseInlineTokens(line))}
                  </p>
                ))}
              </blockquote>
            );
          }
          case 'ul': {
            return (
              <ul key={`ul-${idx}`} className="markdown-list">
                {block.items.map((item, itemIdx) => (
                  <li key={`li-${itemIdx}`}>
                    {renderInlineTokens(parseInlineTokens(item))}
                  </li>
                ))}
              </ul>
            );
          }
          case 'ol': {
            return (
              <ol key={`ol-${idx}`} className="markdown-ordered-list">
                {block.items.map((item, itemIdx) => (
                  <li key={`oli-${itemIdx}`}>
                    {renderInlineTokens(parseInlineTokens(item))}
                  </li>
                ))}
              </ol>
            );
          }
          case 'hr': {
            return <hr key={`hr-${idx}`} className="markdown-hr" />;
          }
          default:
            return null;
        }
      })}
    </div>
  );
};

export default MarkdownRenderer;

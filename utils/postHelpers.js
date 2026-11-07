/**
 * Utilities for post processing: slug generation and excerpt extraction
 */

/**
 * Converts a text string into a URL-friendly slug
 * @param {string} text - Title or string to slugify
 * @returns {string} - Clean, lowercase, hyphenated slug
 */
export const slugify = (text) => {
  if (!text || typeof text !== 'string') {
    return 'untitled-post';
  }

  const slug = text
    .normalize('NFD') // Normalize unicode
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove invalid characters
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-') // Deduplicate hyphens
    .replace(/^-+|-+$/g, ''); // Trim leading and trailing hyphens

  return slug || 'untitled-post';
};

/**
 * Generates a unique slug by appending an incremental counter if slug already exists
 * @param {string} title - The post title
 * @param {function} isSlugTaken - Async function returning boolean if candidate slug is taken
 * @returns {Promise<string>} - A guaranteed unique slug
 */
export const generateUniqueSlug = async (title, isSlugTaken) => {
  const baseSlug = slugify(title);

  if (typeof isSlugTaken !== 'function') {
    return baseSlug;
  }

  const taken = await isSlugTaken(baseSlug);
  if (!taken) {
    return baseSlug;
  }

  let counter = 1;
  while (counter < 10000) {
    const candidate = `${baseSlug}-${counter}`;
    const candidateTaken = await isSlugTaken(candidate);
    if (!candidateTaken) {
      return candidate;
    }
    counter += 1;
  }

  // Fallback safety with timestamp
  return `${baseSlug}-${Date.now()}`;
};

/**
 * Strips Markdown formatting from raw content to generate a clean plain-text excerpt
 * @param {string} content - Raw markdown text
 * @param {number} maxLength - Maximum characters (default 250 per schema)
 * @returns {string} - Clean plain-text excerpt capped at maxLength
 */
export const generateExcerpt = (content, maxLength = 250) => {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const cleanText = content
    // Remove fenced code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove markdown links but keep text: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+(.*)$/gm, '$1')
    // Remove blockquotes
    .replace(/^\s*>\s+/gm, ' ')
    // Remove bold, italic, strikethrough
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    // Remove horizontal rules
    .replace(/^(?:[-*_]\s*){3,}$/gm, ' ')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Normalize consecutive whitespace and newlines to a single space
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  // Truncate safely to maxLength
  let truncated = cleanText.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // Snap to word boundary if not too far from cut-off
  if (lastSpace > maxLength * 0.8) {
    truncated = truncated.slice(0, lastSpace);
  }

  return truncated.trim();
};

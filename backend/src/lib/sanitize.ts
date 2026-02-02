import sanitizeHtml from 'sanitize-html';

/**
 * SECURITY: Sanitize user input to prevent XSS attacks
 *
 * This removes all HTML tags and dangerous content from user input.
 * We use a very strict allowlist - NO HTML tags are allowed.
 */
export function sanitizeInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [], // No HTML tags allowed at all
    allowedAttributes: {}, // No attributes allowed
    disallowedTagsMode: 'escape', // Escape dangerous tags instead of removing
  }).trim();
}

/**
 * SECURITY: Sanitize optional string input
 */
export function sanitizeOptional(input: string | null | undefined): string | null {
  if (!input) return null;
  return sanitizeInput(input);
}

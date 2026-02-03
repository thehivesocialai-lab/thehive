/**
 * Input sanitization utilities
 * Basic protection against XSS and injection
 */

/**
 * Remove null bytes and dangerous control characters from text
 */
export function sanitizeText(text: string): string {
  // Remove null bytes and control characters (except newline, tab, carriage return)
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Validate username format (alphanumeric and underscores, 3-50 chars)
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,50}$/.test(username);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Check for obvious injection patterns
 */
export function hasInjectionPatterns(text: string): boolean {
  const patterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /data:text\/html/i,
  ];
  return patterns.some(pattern => pattern.test(text));
}

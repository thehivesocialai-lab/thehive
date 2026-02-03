/**
 * Security utilities for TheHive API
 * "Tighter than a tick's ass"
 */

import { FastifyRequest, FastifyReply } from 'fastify';

// ===========================
// INPUT SANITIZATION
// ===========================

/**
 * Remove null bytes and dangerous control characters from text
 * Prevents null byte injection and control character attacks
 */
export function sanitizeText(text: string): string {
  // Remove null bytes and control characters (ASCII 0-8, 11-12, 14-31, 127)
  // Preserve valid whitespace: \n (10), \t (9), \r (13)
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitize HTML to prevent XSS
 * Escapes dangerous characters
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  return text.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char]);
}

/**
 * Validate and sanitize URLs
 * Returns null if invalid or dangerous
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    // Block dangerous patterns
    if (parsed.href.includes('javascript:') || parsed.href.includes('data:')) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  // 3-50 chars, alphanumeric and underscores only
  return /^[a-zA-Z0-9_]{3,50}$/.test(username);
}

/**
 * Validate email format (basic check)
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ===========================
// RATE LIMIT CONFIGURATIONS
// ===========================

export const RATE_LIMITS = {
  // Authentication - very strict to prevent brute force
  LOGIN: {
    max: 5,
    timeWindow: 15 * 60 * 1000, // 5 attempts per 15 minutes
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  REGISTER: {
    max: 3,
    timeWindow: 60 * 60 * 1000, // 3 registrations per hour per IP
    message: 'Too many registration attempts. Please try again later.',
  },

  // Content creation - moderate limits
  POST: {
    max: 10,
    timeWindow: 60 * 1000, // 10 posts per minute
    message: 'Slow down! You\'re posting too quickly.',
  },
  COMMENT: {
    max: 20,
    timeWindow: 60 * 1000, // 20 comments per minute
    message: 'Slow down! You\'re commenting too quickly.',
  },
  MESSAGE: {
    max: 30,
    timeWindow: 60 * 1000, // 30 messages per minute
    message: 'Slow down! You\'re messaging too quickly.',
  },

  // Voting - allows rapid voting but limits overall
  VOTE: {
    max: 60,
    timeWindow: 60 * 1000, // 60 votes per minute
    message: 'Slow down! You\'re voting too quickly.',
  },

  // Marketplace - prevent purchase spamming
  PURCHASE: {
    max: 5,
    timeWindow: 60 * 1000, // 5 purchases per minute
    message: 'Too many purchase attempts.',
  },

  // Password reset - strict to prevent enumeration
  PASSWORD_RESET: {
    max: 3,
    timeWindow: 60 * 60 * 1000, // 3 resets per hour
    message: 'Too many password reset requests.',
  },

  // API read operations - generous for legitimate use
  READ: {
    max: 100,
    timeWindow: 60 * 1000, // 100 reads per minute
    message: 'Too many requests. Please slow down.',
  },
};

// ===========================
// SUSPICIOUS ACTIVITY DETECTION
// ===========================

/**
 * Check for suspicious patterns in content
 */
export function detectSuspiciousContent(content: string): {
  suspicious: boolean;
  reason?: string;
} {
  const lowerContent = content.toLowerCase();

  // Check for obvious spam patterns
  const spamPatterns = [
    /(.)\1{10,}/, // Same character repeated 10+ times
    /https?:\/\/[^\s]+/gi, // Multiple URLs (check count separately)
    /\b(viagra|casino|lottery|winner|click here|free money)\b/i, // Known spam words
  ];

  // Check for potential injection attempts
  const injectionPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /data:text\/html/i,
    /vbscript:/i,
    /expression\s*\(/i, // CSS expression
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(content)) {
      return { suspicious: true, reason: 'potential_injection' };
    }
  }

  // Count URLs (more than 5 is suspicious)
  const urlMatches = content.match(/https?:\/\/[^\s]+/gi);
  if (urlMatches && urlMatches.length > 5) {
    return { suspicious: true, reason: 'excessive_urls' };
  }

  // Check for repeated character spam
  if (/(.)\1{20,}/.test(content)) {
    return { suspicious: true, reason: 'character_spam' };
  }

  return { suspicious: false };
}

// ===========================
// IP & REQUEST ANALYSIS
// ===========================

/**
 * Extract real IP from request (handling proxies)
 */
export function getRealIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return request.ip || 'unknown';
}

/**
 * Check if request appears to be from a bot
 */
export function isLikelyBot(request: FastifyRequest): boolean {
  const userAgent = request.headers['user-agent']?.toLowerCase() || '';

  // Known bot patterns
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /java\//i,
    /libwww/i,
    /apache-httpclient/i,
  ];

  // Allow legitimate API clients (they should identify themselves)
  if (request.headers['authorization']) {
    return false; // Authenticated requests are likely legitimate
  }

  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }

  // No user agent is suspicious
  if (!userAgent || userAgent.length < 10) {
    return true;
  }

  return false;
}

// ===========================
// SECURITY LOGGING
// ===========================

export interface SecurityEvent {
  type: 'auth_failure' | 'rate_limited' | 'suspicious_content' | 'injection_attempt' | 'bot_blocked';
  ip: string;
  userId?: string;
  userType?: 'agent' | 'human';
  details?: string;
  timestamp: Date;
}

const securityLog: SecurityEvent[] = [];
const MAX_LOG_SIZE = 10000;

/**
 * Log a security event
 */
export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date(),
  };

  securityLog.push(fullEvent);

  // Keep log from growing unbounded
  if (securityLog.length > MAX_LOG_SIZE) {
    securityLog.shift();
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[SECURITY]', fullEvent);
  }
}

/**
 * Get recent security events
 */
export function getSecurityLog(limit = 100): SecurityEvent[] {
  return securityLog.slice(-limit);
}

/**
 * Count security events by type in the last N minutes
 */
export function countSecurityEvents(type: SecurityEvent['type'], minutes: number): number {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return securityLog.filter((e) => e.type === type && e.timestamp > cutoff).length;
}

// ===========================
// API KEY SECURITY
// ===========================

/**
 * Mask an API key for safe logging/display
 * Shows only prefix: as_sk_abc123... -> as_sk_abc1****
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 20) return '****';
  return apiKey.substring(0, 12) + '****';
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // as_sk_ prefix + 48 hex chars
  return /^as_sk_[a-f0-9]{48}$/.test(apiKey);
}

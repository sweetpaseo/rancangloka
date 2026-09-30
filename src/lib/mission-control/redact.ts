/**
 * RancangLoka Hermes Mission Control — Secret Redaction Utility
 * Milestone: HERMES-MC-1
 * 
 * Invariant: Never allow secrets, tokens, keys, passwords, or raw cookies
 * to be emitted in Mission Control payloads or UI views.
 */

const TOKEN_PATTERNS = [
  /lkmd_[a-zA-Z0-9_-]{20,}/g,
  /bearer\s+[a-zA-Z0-9_.-]{16,}/gi,
  /admin_session=[a-zA-Z0-9_.-]+/gi,
  /sk-[a-zA-Z0-9_-]{20,}/g,
  /(?:api[_-]?key|secret|token|password|auth)["']?\s*[:=]\s*["']?([a-zA-Z0-9_.-]{12,})["']?/gi
];

/**
 * Redacts known sensitive token patterns from arbitrary text strings.
 */
export function sanitizeString(text: string | null | undefined): string {
  if (!text) return '';
  let sanitized = String(text);

  for (const pattern of TOKEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.startsWith('lkmd_')) {
        return 'lkmd_[REDACTED]';
      }
      if (match.toLowerCase().startsWith('bearer')) {
        return 'Bearer [REDACTED]';
      }
      if (match.toLowerCase().startsWith('admin_session=')) {
        return 'admin_session=[REDACTED]';
      }
      return '[REDACTED]';
    });
  }

  return sanitized;
}

/**
 * Deeply sanitizes an object or array to ensure no plain secrets leak.
 */
export function sanitizePayload<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item)) as unknown as T;
  }

  if (typeof value === 'object') {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerKey = k.toLowerCase();
      if (
        lowerKey.includes('secret') ||
        lowerKey.includes('token_hash') ||
        lowerKey.includes('password') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('signing_key')
      ) {
        copy[k] = '[REDACTED]';
      } else {
        copy[k] = sanitizePayload(v);
      }
    }
    return copy as T;
  }

  return value;
}

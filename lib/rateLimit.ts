/**
 * Simple in-memory rate limiter for auth endpoints.
 * Tracks requests by IP address with a sliding window.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 15 * 60 * 1000  // 15 minutes
const MAX_ATTEMPTS = 10             // max 10 attempts per window

function cleanExpired() {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}

/**
 * Check if a request from the given identifier should be blocked.
 * Returns { allowed: boolean, remaining: number, retryAfterMs: number }
 */
export function checkRateLimit(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanExpired()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // First request or window expired — start new window
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterMs: 0 }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    }
  }

  entry.count++
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count, retryAfterMs: 0 }
}

export function getClientKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || 'unknown'
}

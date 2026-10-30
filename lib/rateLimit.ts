/**
 * Simple in-memory rate limiter for auth endpoints.
 * Tracks requests by IP address (and optionally by account) with a sliding window.
 *
 * ★ 2026-10-30 安全修复：
 *   旧实现 getClientKey() 直接取 `X-Forwarded-For` 的**第一个**值。
 *   该头完全由客户端可控 —— 攻击者只要每次换一个 X-Forwarded-For，
 *   就能让每个请求都落到不同的计数桶里，限流形同虚设（已实测绕过）。
 *   现在改为：只信任 Hostinger/反代**追加**到末尾的那一段
 *   （即 XFF 链路的最后一个值，最靠近服务器、由反代写入），
 *   并在其基础上再做一层「账号维度」限流（按邮箱/账号），
 *   即使 IP 维度仍被绕过，账号维度依然能挡住爆破。
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 10 // max 10 attempts per window

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
export function checkRateLimit(
  key: string,
  options?: { maxAttempts?: number; windowMs?: number }
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanExpired()

  const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS
  const windowMs = options?.windowMs ?? WINDOW_MS

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // First request or window expired — start new window
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxAttempts - 1, retryAfterMs: 0 }
  }

  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    }
  }

  entry.count++
  return { allowed: true, remaining: maxAttempts - entry.count, retryAfterMs: 0 }
}

/**
 * 取可信客户端 IP。
 *
 * X-Forwarded-For 的语义是「客户端, 代理1, 代理2, ...」，
 * 越靠右的段越靠近服务器、越由可信反代写入。Hostinger 会在链尾追加真实 IP，
 * 因此**最后一段**才是我们该信任的；最左边那段是客户端自己写的，可以随便伪造。
 *
 * 退化顺序：XFF 尾段 → X-Real-IP → 'unknown'。
 */
export function getClientKey(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    // 取链尾（最靠近服务器、最可信）的一段
    const tail = parts[parts.length - 1]
    if (tail) return tail
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

/**
 * 账号维度限流：同一个 email 在窗口内的尝试次数上限。
 * 与 IP 维度叠加使用 —— IP 可伪造，但账号维度挡不住「同一账号换 IP 爆破」。
 */
export function checkAccountRateLimit(
  email: string,
  maxAttempts = 5,
  windowMs = WINDOW_MS
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const normalized = email.trim().toLowerCase()
  if (!normalized) {
    // 没有账号标识就不做账号维度限制
    return { allowed: true, remaining: MAX_ATTEMPTS, retryAfterMs: 0 }
  }
  return checkRateLimit(`account:${normalized}`, { maxAttempts, windowMs })
}

/**
 * 组合检查：IP 维度 + 账号维度。任一维度被限即拒绝。
 */
export function checkLoginRateLimit(
  request: Request,
  email: string
): { allowed: boolean; remaining: number; retryAfterMs: number; scope?: 'ip' | 'account' } {
  const ipResult = checkRateLimit(`login:${getClientKey(request)}`)
  if (!ipResult.allowed) return { ...ipResult, scope: 'ip' }

  const accountResult = checkAccountRateLimit(email)
  if (!accountResult.allowed) return { ...accountResult, scope: 'account' }

  return { ...ipResult, scope: undefined }
}

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return new TextEncoder().encode(secret)
}

/**
 * Visitor token: proves a browser owns a specific chat conversation.
 * Signed with JWT_SECRET so no DB schema change is required.
 */
export async function signVisitorToken(conversationId: string): Promise<string> {
  return new SignJWT({ scope: 'chat-visitor', cid: conversationId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifyVisitorToken(
  token: string | null | undefined,
  conversationId: string
): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.scope === 'chat-visitor' && payload.cid === conversationId
  } catch {
    return false
  }
}

/** Admin request: needs `Authorization: Bearer <jwt>` with role ADMIN */
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false

  try {
    const { payload } = await jwtVerify(authHeader.substring(7), getSecret())
    return payload.role === 'ADMIN'
  } catch {
    return false
  }
}

/**
 * 诊断式鉴权：告诉调用方到底是「没带 Token / Token 无效 / 角色不对」，
 * 避免采集脚本只看到一个 401/403 猜不出原因。
 */
export async function describeAuth(request: NextRequest): Promise<{
  valid: boolean
  role?: string
  reason: string
}> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { valid: false, reason: 'missing_authorization_header' }
  if (!authHeader.startsWith('Bearer ')) return { valid: false, reason: 'bad_authorization_scheme' }
  const token = authHeader.substring(7).trim()
  if (!token) return { valid: false, reason: 'empty_token' }
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const role = (payload as any).role
    if (role === 'ADMIN') return { valid: true, role, reason: 'ok' }
    return { valid: true, role, reason: 'role_not_admin' }
  } catch (e: any) {
    return { valid: false, reason: 'token_verify_failed: ' + (e?.message || 'unknown') }
  }
}

/** Read the visitor token from header or body */
export function getVisitorToken(request: NextRequest, body?: any): string | null {
  return request.headers.get('x-chat-token') || body?.visitorToken || null
}

/**
 * Guard for diagnostic endpoints.
 * Allowed in development; in production only admins may call.
 */
export async function requireAdminOrDev(request: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== 'production') return null
  if (await isAdminRequest(request)) return null
  return NextResponse.json(
    { success: false, error: 'Not found' },
    { status: 404 }
  )
}

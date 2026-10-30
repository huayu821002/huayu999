import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export type AuthedUser = { userId: string; email: string; role: string }

/**
 * 统一的「必须管理员」守卫。
 *
 * ★ 2026-10-30 安全修复背景：
 *   - /api/products 的 POST（建商品）原来完全公开 → 任何人可写库、塞垃圾商品。
 *   - /api/admin/* 靠 middleware 拦，但 middleware 的 matcher 也覆盖非 admin 路径，
 *     且业务代码里没有第二道防线；一旦路由被误挂到 /api/admin 之外就裸奔。
 * 所以：写接口一律在**业务代码里**显式校验角色，不依赖路径约定。
 */
export async function requireAdmin(
  request: Request
): Promise<AuthedUser | NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const user = await verifyToken(token)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
  }
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  return user
}

/** 判断 requireAdmin 的返回值是不是错误响应 */
export function isAuthError(result: AuthedUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// ★ 2026-10-30 安全修复：JWT 密钥**不再有回落默认值**。
// 旧代码在生产缺 JWT_SECRET 时会静默使用一个写在源码里的公开密钥
// → 任何人都能自己签发 role=ADMIN 的 token，整站沦陷。
// 现在：生产环境缺密钥时，admin 路由一律拒绝（fail closed，不给「用默认密钥放行」的缝），
// 但**不**让整个模块抛错 —— 否则整站（含前台商城）一起挂掉。
// 开发环境才允许用固定开发密钥，方便本地起服务。
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const JWT_SECRET_VALUE = process.env.JWT_SECRET || 'dev-only-insecure-secret'
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_VALUE)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CORS 预检请求不带 Authorization，必须放行，否则跨域采集会被 401 拦掉
  if (request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  // Protect admin API routes
  if (pathname.startsWith('/api/admin')) {
    // 生产环境缺 JWT_SECRET → 直接拒绝所有 admin 请求（fail closed）
    if (IS_PRODUCTION && !process.env.JWT_SECRET) {
      console.error('[middleware] JWT_SECRET is not set; refusing all /api/admin requests')
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      if (payload.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }
  }

  // ★ 2026-10-30：后台页面 / 采集器安装页也必须登录后才能看。
  //   之前只保护了 /api/admin（数据接口），页面本身是公开的：
  //   任何人都能打开 /admin/orders、/1688-collector 看到后台外壳和内部流程说明。
  //   页面鉴权靠登录时下发的 httpOnly cookie `ff_admin_session`（role=ADMIN 的 JWT），
  //   服务端在中间件里直接验签 —— 比前端 localStorage 判断可靠（防的不只是"看到页面"）。
  const isAdminPage =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/1688-collector'

  if (isAdminPage) {
    if (IS_PRODUCTION && !process.env.JWT_SECRET) {
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
    }

    const cookieToken = request.cookies.get('ff_admin_session')?.value
    let role: string | undefined
    if (cookieToken) {
      try {
        const { payload } = await jwtVerify(cookieToken, JWT_SECRET)
        role = (payload as any).role
      } catch {
        role = undefined
      }
    }

    if (role !== 'ADMIN') {
      // 页面请求 → 302 去登录页（带 next 参数，登录后跳回）
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/admin/:path*',
    '/admin',
    '/1688-collector',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

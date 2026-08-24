import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const LOCALE_COOKIE = 'NEXT_LOCALE'

async function verifyAdminToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const token = authHeader.slice(7)
  const JWT_SECRET = process.env.JWT_SECRET

  // No fallback — reject if not configured
  if (!JWT_SECRET) return false

  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload.role === 'ADMIN'
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin route protection
  if (pathname.startsWith('/api/admin')) {
    const isAdmin = await verifyAdminToken(request)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 401 }
      )
    }
  }

  // Locale detection
  const hostname = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const subdomain = hostname.split('.')[0]
  const localeMap: Record<string, string> = { br: 'pt', ru: 'ru' }
  const detectedLocale = localeMap[subdomain]

  if (detectedLocale) {
    const response = NextResponse.next()
    response.cookies.set(LOCALE_COOKIE, detectedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

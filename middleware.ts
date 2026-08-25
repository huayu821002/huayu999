import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LOCALE_COOKIE = 'NEXT_LOCALE'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // TEMPORARILY DISABLED: Admin route protection
  // TODO: Re-enable after fixing adminFetch token issue
  // if (pathname.startsWith('/api/admin')) {
  //   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  // }

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

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LOCALE_COOKIE = 'NEXT_LOCALE'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  
  // Extract subdomain (br.fiestaflare.com -> br, ru.fiestaflare.com -> ru)
  const subdomain = hostname.split('.')[0]
  
  const localeMap: Record<string, string> = {
    br: 'pt',
    ru: 'ru',
  }
  
  const detectedLocale = localeMap[subdomain]
  
  if (detectedLocale) {
    // Set cookie for server components to read
    const response = NextResponse.next()
    response.cookies.set(LOCALE_COOKIE, detectedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    })
    return response
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files and api routes
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}

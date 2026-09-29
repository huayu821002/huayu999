import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production'
)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect admin API routes
  if (pathname.startsWith('/api/admin')) {
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

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

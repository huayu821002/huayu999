import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Currency detection based on timezone
const TIMEZONE_CURRENCY_MAP: Record<string, string> = {
  'America/New_York': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Phoenix': 'USD',
  'America/Toronto': 'USD',
  'America/Vancouver': 'USD',
  'America/Mexico_City': 'MXN',
  'America/Cancun': 'MXN',
  'America/Monterrey': 'MXN',
  'America/Sao_Paulo': 'BRL',
  'America/Rio_Branco': 'BRL',
  'America/Brasilia': 'BRL',
  'America/Buenos_Aires': 'BRL',
  'America/Lima': 'BRL',
  'America/Bogota': 'BRL',
  'America/Santiago': 'BRL',
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Get preferred currency from timezone header (set by edge function or browser)
  const timezone = request.headers.get('x-timezone') || 
                   request.headers.get('x-vercel-ip-timezone') ||
                   'America/New_York'

  // Determine currency based on timezone
  const currency = TIMEZONE_CURRENCY_MAP[timezone] || 'USD'

  // Add currency to response headers for client-side access
  response.headers.set('x-currency', currency)
  response.headers.set('x-timezone', timezone)

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes that don't need currency detection
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/health).*)',
  ],
}

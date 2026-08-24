import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const payload = await verifyToken(token)

  if (!payload) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
  }

  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    success: true,
    data: {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    },
  })
}

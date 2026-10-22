import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/chatAuth'

export async function GET(request: NextRequest) {
  // Diagnostic endpoint: hidden from public in production
  const denied = await requireAdminOrDev(request)
  if (denied) return denied

  try {
    // Test database connection
    const count = await prisma.chatConversation.count()
    return NextResponse.json({
      success: true,
      message: 'Chat API is working',
      dbConnected: true,
      conversationCount: count,
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: 'Database error',
      dbConnected: false,
      error: err.message,
    })
  }
}

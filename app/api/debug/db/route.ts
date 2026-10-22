import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/chatAuth'

export async function GET(request: NextRequest) {
  // Diagnostic endpoint: hidden from public in production
  const denied = await requireAdminOrDev(request)
  if (denied) return denied

  try {
    const count = await prisma.chatConversation.count()
    const conversations = await prisma.chatConversation.findMany({
      take: 1,
      include: { messages: { take: 1 } }
    })
    return NextResponse.json({ success: true, count, sample: conversations })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      meta: error.meta,
    }, { status: 500 })
  }
}

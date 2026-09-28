import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
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

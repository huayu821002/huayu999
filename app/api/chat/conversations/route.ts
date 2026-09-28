import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - List all conversations (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // OPEN | CLOSED | all
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where = status && status !== 'all' ? { status } : {}

    const [conversations, total] = await Promise.all([
      prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          }
        }
      }),
      prisma.chatConversation.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: conversations.map(c => ({
        id: c.id,
        visitorEmail: c.visitorEmail,
        visitorName: c.visitorName,
        status: c.status,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        messageCount: c.messages[0] ? 1 : 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

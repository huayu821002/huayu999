import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST - Admin reply to conversation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { content, adminId } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Verify conversation exists
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: params.id }
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Create admin message
    const message = await prisma.chatMessage.create({
      data: {
        conversationId: params.id,
        content,
        senderType: 'ADMIN',
        senderId: adminId || 'admin',
      }
    })

    // Update conversation - human has replied, disable AI
    await prisma.chatConversation.update({
      where: { id: params.id },
      data: {
        lastMessage: content.substring(0, 100),
        lastMessageAt: new Date(),
        status: 'OPEN',
        aiDisabled: true,
      }
    })

    return NextResponse.json({ success: true, data: message })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

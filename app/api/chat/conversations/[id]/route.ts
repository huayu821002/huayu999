import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminRequest, verifyVisitorToken, getVisitorToken } from '@/lib/chatAuth'

// GET - Get single conversation with all messages
// Allowed for admins, or for the visitor who owns the conversation (via visitor token)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const isAdmin = await isAdminRequest(request)
    if (!isAdmin) {
      const token = getVisitorToken(request)
      if (!(await verifyVisitorToken(token, params.id))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    }

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: params.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        }
      }
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: conversation })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update conversation (e.g., close it) - admin only
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { status } = await request.json()

    const conversation = await prisma.chatConversation.update({
      where: { id: params.id },
      data: { status }
    })

    return NextResponse.json({ success: true, data: conversation })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

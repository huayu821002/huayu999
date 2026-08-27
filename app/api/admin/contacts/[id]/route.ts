import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contact = await prisma.contact.update({
      where: { id: params.id },
      data: { isRead: true },
    })
    return NextResponse.json({ data: contact })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.contact.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

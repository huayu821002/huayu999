import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: Request, { params }: { params: { variantId: string } }) {
  try {
    await prisma.productVariant.delete({ where: { id: params.variantId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete variant' }, { status: 500 })
  }
}

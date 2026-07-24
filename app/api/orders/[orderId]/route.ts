import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { orderId: string } }) {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: params.orderId },
    })
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 })
  }
}

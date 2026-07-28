import { NextRequest, NextResponse } from 'next/server'
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

export async function PATCH(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const body = await request.json()
    const { status, paymentId } = body

    const order = await prisma.order.update({
      where: { orderNumber: params.orderId },
      data: {
        ...(status && { status }),
        ...(paymentId && { paymentId }),
      },
    })
    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 })
  }
}

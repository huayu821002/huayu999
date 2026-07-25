import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { user: true },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // Parse items JSON
    let parsedItems = []
    try {
      parsedItems = JSON.parse(order.items)
    } catch {
      parsedItems = []
    }

    return NextResponse.json({ 
      success: true, 
      data: { ...order, parsedItems } 
    })
  } catch (error) {
    console.error('Order detail error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const body = await request.json()
    const { 
      status, 
      trackingNumber, 
      trackingUrl, 
      notes,
      shippingAddress 
    } = body

    const updateData: Record<string, unknown> = {}
    
    if (status !== undefined) updateData.status = status
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber
    if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl
    if (notes !== undefined) updateData.notes = notes
    if (shippingAddress !== undefined) updateData.shippingAddress = shippingAddress

    const order = await prisma.order.update({
      where: { id: params.orderId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Order update error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 })
  }
}

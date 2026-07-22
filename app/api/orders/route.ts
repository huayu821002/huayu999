import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (userId) {
      where.userId = userId
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: orders })
  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      userId, items, subtotal, shippingCost, tax, discount, total,
      currency, shippingAddress, billingAddress, paymentMethod
    } = body

    // Generate order number
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    const orderNumber = `JH-${timestamp}-${random}`

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        items: JSON.stringify(items),
        subtotal: parseFloat(subtotal),
        shippingCost: parseFloat(shippingCost),
        tax: parseFloat(tax),
        discount: parseFloat(discount) || 0,
        total: parseFloat(total),
        currency: currency || 'USD',
        shippingAddress: typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify(shippingAddress),
        billingAddress: billingAddress ? (typeof billingAddress === 'string' ? billingAddress : JSON.stringify(billingAddress)) : null,
        paymentMethod,
        status: 'PENDING',
      },
    })

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

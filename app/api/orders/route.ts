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
      currency, shippingAddress, billingAddress, paymentMethod,
      paypalOrderId, paypalStatus
    } = body

    // Generate order number
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    const orderNumber = `JH-${timestamp}-${random}`

    // Safely parse numbers with defaults
    const parseNum = (val: any, defaultVal = 0): number => {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? defaultVal : parsed
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: userId || null,
        items: JSON.stringify(items || []),
        subtotal: parseNum(subtotal),
        shippingCost: parseNum(shippingCost),
        tax: parseNum(tax),
        discount: parseNum(discount),
        total: parseNum(total),
        currency: currency || 'USD',
        shippingAddress: typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify(shippingAddress || {}),
        billingAddress: billingAddress ? (typeof billingAddress === 'string' ? billingAddress : JSON.stringify(billingAddress)) : null,
        paymentMethod: paymentMethod || 'BATCH_ORDER',
        paymentId: paypalOrderId || null,
        status: paypalStatus === 'COMPLETED' ? 'PAID' : 'PENDING',
      },
    })

    return NextResponse.json({ success: true, data: order })
  } catch (error: any) {
    console.error('Create order error:', error)
    console.error('Create order full error:', JSON.stringify(error, null, 2))
    return NextResponse.json(
      { success: false, error: 'Failed to create order: ' + (error?.message || 'Unknown error'), details: error?.message, code: error?.code },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET /api/orders — 需要登录，用户只能查看自己的订单，admin 可以查看所有
export async function GET(request: Request) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const requestedUserId = searchParams.get('userId')

    const where: Record<string, unknown> = {}

    // 非 admin 只能查看自己的订单
    if (user.role !== 'ADMIN') {
      where.userId = user.userId
    } else if (requestedUserId) {
      // admin 可以指定查看某个用户的订单
      where.userId = requestedUserId
    }

    if (status) {
      where.status = status
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

// POST /api/orders — 公开接口（用于创建批量订单，无需登录）
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

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET /api/orders/[orderId] — 需要登录，用户只能查看自己的订单，admin 可以查看所有
export async function GET(request: Request, { params }: { params: { orderId: string } }) {
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

    const order = await prisma.order.findUnique({
      where: { orderNumber: params.orderId },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // 非 admin 只能查看自己的订单
    if (user.role !== 'ADMIN' && order.userId !== user.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 })
  }
}

// PATCH /api/orders/[orderId] — 更新订单状态/支付信息
// ADMIN 可以更新任何订单，客户只能更新自己的订单（用于付款后标记PAID）
export async function PATCH(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { status, paymentId } = body

    // 查找订单
    const order = await prisma.order.findUnique({
      where: { orderNumber: params.orderId },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // ADMIN 可以更新任何订单
    // 客户只能更新自己的订单（仅限标记为PAID）
    if (user.role !== 'ADMIN' && order.userId !== user.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // 非 admin 只能将订单标记为 PAID（付款后）
    if (user.role !== 'ADMIN') {
      if (status && status !== 'PAID') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
      if (paymentId && order.userId !== user.userId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
    }

    const updated = await prisma.order.update({
      where: { orderNumber: params.orderId },
      data: {
        ...(status && { status }),
        ...(paymentId && { paymentId }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 })
  }
}

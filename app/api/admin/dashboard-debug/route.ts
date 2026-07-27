import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [totalOrders, totalCustomers, totalProducts] = await Promise.all([
      prisma.order.count(),
      prisma.user.count(),
      prisma.product.count(),
    ])

    const recentOrders = await prisma.order.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
        orderItems: { select: { quantity: true } },
      },
    })

    return NextResponse.json({
      totalOrders,
      totalCustomers,
      totalProducts,
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        userId: o.userId,
        userName: o.user?.name,
        total: o.total,
        status: o.status,
        orderItemsCount: o.orderItems.length,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}

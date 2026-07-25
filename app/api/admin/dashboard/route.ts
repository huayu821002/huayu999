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
      take: 5,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        stats: { orders: totalOrders, customers: totalCustomers, products: totalProducts },
        recentOrders,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

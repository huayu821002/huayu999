import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function parseProductImages(imgStr: string): string[] {
  if (!imgStr) return []
  try {
    const parsed = JSON.parse(imgStr)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return imgStr.split(',').map(s => s.trim()).filter(Boolean)
  }
}

export async function GET() {
  try {
    const [totalOrders, totalCustomers, totalProducts, ordersWithStats] = await Promise.all([
      prisma.order.count(),
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { total: true, status: true },
      }),
    ])

    // Calculate stats
    const revenue = ordersWithStats.reduce((sum: any, o: any) => sum + (o.total || 0), 0)
    const pending = ordersWithStats.filter((o: any) => o.status === 'PENDING').length
    const processing = ordersWithStats.filter((o: any) => o.status === 'PROCESSING').length
    const shipped = ordersWithStats.filter((o: any) => o.status === 'SHIPPED').length

    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
        orderItems: { select: { quantity: true } },
      },
    })

    // Get recent products (last 5 created, with images)
    const recentProducts = await prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        images: true,
      },
    })

    // Transform recentOrders to expected format
    const formattedOrders = recentOrders.map((o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.user?.name || 'Unknown',
      items: o.orderItems.reduce((sum: any, i: any) => sum + i.quantity, 0),
      total: o.total,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    }))

    // Transform to TopProduct format
    const topProducts = recentProducts.map((p: any) => {
      const images = parseProductImages(p.images || '')
      return {
        id: p.id,
        name: p.name,
        sales: 0,
        revenue: '$0',
        image: images[0] || null,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          revenue,
          orders: totalOrders,
          customers: totalCustomers,
          products: totalProducts,
          pending,
          processing,
          shipped,
        },
        recentOrders: formattedOrders,
        topProducts,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

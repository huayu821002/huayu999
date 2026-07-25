import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get stats
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      totalCustomers,
      totalProducts,
      recentOrders,
      topProducts,
    ] = await Promise.all([
      // Order counts by status
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'PROCESSING' } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      
      // Customer count
      prisma.user.count({ where: { role: 'USER' } }),
      
      // Product count
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      
      // Recent orders (last 10)
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      
      // Top products by order items (simplified - just get products with most cart items)
      prisma.product.findMany({
        where: { status: 'ACTIVE' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          price: true,
          images: true,
          _count: { select: { cartItems: true } },
        },
      }),
    ])

    // Calculate revenue from completed orders (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const revenueResult = await prisma.order.aggregate({
      where: {
        status: { in: ['PROCESSING', 'SHIPPED', 'DELIVERED'] },
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { total: true },
    })
    const revenue = revenueResult._sum.total || 0

    // Parse recent orders items
    const recentOrdersWithItems = recentOrders.map(order => {
      let itemCount = 0
      try {
        const items = JSON.parse(order.items)
        itemCount = Array.isArray(items) ? items.length : 0
      } catch {}
      
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.user?.name || order.user?.email || 'Guest',
        items: itemCount,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
      }
    })

    // Get top products with sales data (using cart items as proxy for popularity)
    const topProductsData = topProducts.map(p => ({
      id: p.id,
      name: p.name,
      sales: p._count.cartItems,
      revenue: `$${(p.price * p._count.cartItems).toFixed(0)}`,
      image: (() => {
        if (!p.images) return null
        try {
          const parsed = JSON.parse(p.images)
          return Array.isArray(parsed) ? parsed[0] : parsed
        } catch { return p.images }
      })(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          revenue,
          orders: totalOrders,
          customers: totalCustomers,
          products: totalProducts,
          pending: pendingOrders,
          processing: processingOrders,
          shipped: shippedOrders,
        },
        recentOrders: recentOrdersWithItems,
        topProducts: topProductsData,
      },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}

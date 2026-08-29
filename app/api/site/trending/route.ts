import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all completed/paid orders
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
      },
      select: { items: true },
    })

    // Count sales per product
    const salesMap = new Map<string, number>()
    for (const order of orders) {
      try {
        const items = JSON.parse(order.items)
        for (const item of items) {
          const current = salesMap.get(item.productId) || 0
          salesMap.set(item.productId, current + (item.quantity || 1))
        }
      } catch {}
    }

    // Sort by sales count and take top 8
    const topProductIds = Array.from(salesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id)

    // If not enough sales data, fall back to isTrending flag or newest
    if (topProductIds.length < 4) {
      const fallbackProducts = await prisma.product.findMany({
        where: { isActive: true },
        take: 8,
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ success: true, data: fallbackProducts, source: 'fallback' })
    }

    // Fetch full product data for top sellers
    const trendingProducts = await prisma.product.findMany({
      where: {
        id: { in: topProductIds },
        isActive: true,
      },
    })

    // Fetch categories and merge
    const allCategoryIds = trendingProducts.flatMap(p => p.categoryIds ? JSON.parse(p.categoryIds) : [])
    const categories = await prisma.category.findMany({ where: { id: { in: allCategoryIds } } })
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const productsWithCategories = trendingProducts.map(p => ({
      ...p,
      categories: (p.categoryIds ? JSON.parse(p.categoryIds) : []).map((id: string) => categoryMap.get(id)).filter(Boolean)
    }))

    // Maintain order by sales rank
    const orderedProducts = topProductIds
      .map(id => productsWithCategories.find(p => p.id === id))
      .filter(Boolean)

    return NextResponse.json({ success: true, data: orderedProducts, source: 'sales' })
  } catch (error) {
    console.error('Trending products error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch trending products' }, { status: 500 })
  }
}

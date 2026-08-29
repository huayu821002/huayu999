import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: params.slug },
    })

    // Calculate total sold count from order items (completed orders only)
    const soldCount = product ? await prisma.orderItem.aggregate({
      where: {
        productId: product.id,
        order: { status: { in: ['PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      },
      _sum: { quantity: true },
    }) : { _sum: { quantity: 0 } }

    // Fetch categories
    let categories: any[] = []
    if (product?.categoryIds) {
      const catIds = JSON.parse(product.categoryIds)
      const cats = await prisma.category.findMany({ where: { id: { in: catIds } } })
      categories = cats
    }

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      data: { ...product, categories, soldCount: soldCount._sum.quantity || 0 }
    })
  } catch (error) {
    console.error('Product API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: params.slug },
      include: { categories: { select: { id: true, name: true, slug: true } } },
    })

    // Calculate total sold count from order items (completed orders only)
    const soldCount = await prisma.orderItem.aggregate({
      where: {
        productId: product?.id,
        order: { status: { in: ['PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      },
      _sum: { quantity: true },
    })

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      data: { ...product, soldCount: soldCount._sum.quantity || 0 }
    })
  } catch (error) {
    console.error('Product API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 })
  }
}

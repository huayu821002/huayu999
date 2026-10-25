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

    // 变体：存在 Product.variants（JSON），需要给每项补一个稳定 id
    let variants: any[] = []
    try {
      const raw = product.variants ? JSON.parse(product.variants) : []
      if (Array.isArray(raw)) {
        variants = raw
          .filter((v: any) => v && typeof v === 'object')
          .map((v: any, i: number) => ({
            id: String(v.id || `v-${i}`),
            name: String(v.name || ''),
            value: String(v.value || ''),
            sku: v.sku ?? null,
            price: typeof v.price === 'number' ? v.price : null,
            inventory: Number.isFinite(Number(v.inventory)) ? Number(v.inventory) : null,
            image: v.image ?? null,
          }))
      }
    } catch {
      variants = []
    }

    const { variants: _rawVariants, variantDims: _rawDims, ...rest } = product as any

    return NextResponse.json({
      success: true,
      data: { ...rest, categories, soldCount: soldCount._sum.quantity || 0, variants }
    })
  } catch (error) {
    console.error('Product API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 })
  }
}

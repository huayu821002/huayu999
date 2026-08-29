import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { slug: { contains: search } },
      ]
    }

    let products
    try {
      products = await prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })
    } catch (innerError: any) {
      console.error('Query without include failed:', innerError)
      return NextResponse.json({ success: false, error: 'Query failed', details: innerError?.message }, { status: 500 })
    }

    // Try to fetch categories separately
    let categories: any[] = []
    try {
      categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    } catch (innerError: any) {
      console.error('Category query failed:', innerError)
    }

    // Merge categories data manually (categoryIds stored as JSON array)
    const categoryMap = new Map(categories.map((c: any) => [c.id, c]))
    const productsWithCategory = products.map((p: any) => {
      const catIds = p.categoryIds ? JSON.parse(p.categoryIds) : []
      const cats = catIds.map((id: string) => categoryMap.get(id)).filter(Boolean)
      return { ...p, categories: cats }
    })

    return NextResponse.json({ success: true, data: productsWithCategory, count: products.length })
  } catch (error: any) {
    console.error('Admin products GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch products', details: error?.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name, slug, description, shortDesc,
      price, comparePrice, costPrice, wholesalePrice, vipPrice,
      weight, images, sku, barcode, inventory,
      categoryIds, isActive, isFeatured, isTrending,
      minOrderQty, lowStockAlert
    } = body

    // Auto-generate slug if not provided
    const generatedSlug = slug || name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36)

    const product = await prisma.product.create({
      data: {
        name,
        slug: generatedSlug,
        description,
        shortDesc: shortDesc || null,
        price: parseFloat(price) || 0,
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        vipPrice: vipPrice ? parseFloat(vipPrice) : null,
        weight: weight ? parseFloat(weight) : null,
        images: Array.isArray(images) ? JSON.stringify(images) : images,
        sku,
        barcode,
        inventory: parseInt(inventory) || 0,
        categoryIds: categoryIds ? JSON.stringify(categoryIds) : null,
        isActive: isActive !== undefined ? isActive : true,
        isFeatured: isFeatured || false,
        isTrending: isTrending || false,
        minOrderQty: parseInt(minOrderQty) || 1,
        lowStockAlert: parseInt(lowStockAlert) || 10,
      },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error: any) {
    console.error('Admin products POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create product', details: error?.message }, { status: 500 })
  }
}

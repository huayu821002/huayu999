import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    // Test database connection first
    try {
      await prisma.$connect()
    } catch (dbError: any) {
      console.error('Database connection error:', dbError)
      return NextResponse.json({ success: false, error: 'Database connection failed', details: dbError?.message }, { status: 500 })
    }

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { slug: { contains: search } },
      ]
    }

    // First try without include to isolate the issue
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

    // Merge category data manually
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const productsWithCategory = products.map(p => ({
      ...p,
      category: p.categoryId ? categoryMap.get(p.categoryId) || null : null
    }))

    return NextResponse.json({ success: true, data: productsWithCategory, count: products.length })
  } catch (error: any) {
    console.error('Admin products GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch products', details: error?.message, code: error?.code, stack: error?.stack }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name, slug, description, shortDesc, price, comparePrice, costPrice,
      wholesalePrice, vipPrice, minOrderQty, weight, dimensions, images,
      modelImage, sizeChart, sku, barcode, inventory, lowStockAlert,
      categoryId, tags, isActive, isFeatured, isTrending, compliance
    } = body

    const product = await prisma.product.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36),
        description,
        shortDesc,
        price: parseFloat(price),
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        vipPrice: vipPrice ? parseFloat(vipPrice) : null,
        minOrderQty: parseInt(minOrderQty) || 1,
        weight: weight ? parseFloat(weight) : null,
        dimensions,
        images: Array.isArray(images) ? JSON.stringify(images) : images,
        modelImage,
        sizeChart,
        sku,
        barcode,
        inventory: parseInt(inventory) || 0,
        lowStockAlert: parseInt(lowStockAlert) || 10,
        categoryId,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : tags,
        isActive: isActive !== false,
        isFeatured: isFeatured === true,
        isTrending: isTrending === true,
        compliance,
      },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Admin products POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create product' }, { status: 500 })
  }
}

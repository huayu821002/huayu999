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

    // Merge category data manually
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const productsWithCategory = products.map(p => ({
      ...p,
      category: p.categoryId ? categoryMap.get(p.categoryId) || null : null
    }))

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
      name, slug, description, price, comparePrice, costPrice,
      weight, images, sku, barcode, inventory,
      categoryId, isActive, isFeatured, isTrending
    } = body

    const product = await prisma.product.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36),
        description,
        price: parseFloat(price) || 0,
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        weight: weight ? parseFloat(weight) : null,
        images: Array.isArray(images) ? JSON.stringify(images) : images,
        sku,
        barcode,
        inventory: parseInt(inventory) || 0,
        categoryId,
        isActive: isActive || 'ACTIVE',
        isFeatured: isFeatured || false,
        isTrending: isTrending || false,
      },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error: any) {
    console.error('Admin products POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create product', details: error?.message }, { status: 500 })
  }
}

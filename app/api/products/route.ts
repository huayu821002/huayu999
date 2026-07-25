import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (category) {
      where.category = { slug: category }
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { sku: { contains: search } },
      ]
    }

    // Fetch products
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Fetch categories separately
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    const categoryMap = new Map(categories.map(c => [c.id, c]))

    // Merge category data manually
    const productsWithCategory = products.map(p => ({
      ...p,
      category: p.categoryId ? categoryMap.get(p.categoryId) || null : null
    }))

    return NextResponse.json({ success: true, data: productsWithCategory })
  } catch (error: any) {
    console.error('Products API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch products', details: error?.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name, slug, description, price, comparePrice, costPrice,
      weight, images, sku, barcode, inventory,
      categoryId, status
    } = body

    const product = await prisma.product.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        price: parseFloat(price),
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        weight: weight ? parseFloat(weight) : null,
        images: typeof images === 'string' ? images : JSON.stringify(images),
        sku,
        barcode,
        inventory: parseInt(inventory) || 0,
        categoryId,
        status: status || 'ACTIVE',
      },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create product' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const trending = searchParams.get('trending')
    const featured = searchParams.get('featured')

    const where: Record<string, unknown> = { isActive: true }

    if (category) {
      where.category = { slug: category }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (trending === 'true') {
      where.isTrending = true
    }

    if (featured === 'true') {
      where.isFeatured = true
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: products })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name, slug, description, shortDesc, price, comparePrice,
      costPrice, wholesalePrice, vipPrice, minOrderQty, weight,
      dimensions, images, modelImage, sku, barcode, inventory,
      categoryId, tags, isTrending, isFeatured
    } = body

    const product = await prisma.product.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
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
        images,
        modelImage,
        sku,
        barcode,
        inventory: parseInt(inventory) || 0,
        categoryId,
        tags: tags || '',
        isTrending: isTrending || false,
        isFeatured: isFeatured || false,
      },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    )
  }
}

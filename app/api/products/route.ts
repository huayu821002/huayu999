import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const trending = searchParams.get('trending')
    const featured = searchParams.get('featured')

    const where: Record<string, unknown> = {}

    if (category) {
      where.categories = { some: { slug: category } }
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { sku: { contains: search } },
      ]
    }

    if (trending === 'true') {
      where.isTrending = true
    }

    if (featured === 'true') {
      where.isFeatured = true
    }

    // Fetch products without include to avoid serialization issues
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { categories: { select: { id: true, name: true, slug: true } } },
    })

    return NextResponse.json({ success: true, data: products })
  } catch (error: any) {
    console.error('Products API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch products', details: error?.message, code: error?.code }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name, slug, description, shortDesc, price, comparePrice, costPrice,
      wholesalePrice, vipPrice, minOrderQty, weight, dimensions, images,
      modelImage, sizeChart, sku, barcode, inventory, lowStockAlert,
      tags, isActive, isFeatured, isTrending, compliance
    } = body

    const product = await prisma.product.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
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
        images: typeof images === 'string' ? images : JSON.stringify(images),
        modelImage,
        sizeChart,
        sku,
        barcode,
        inventory: parseInt(inventory) || 0,
        lowStockAlert: parseInt(lowStockAlert) || 10,
        tags,
        isActive: isActive !== false,
        isFeatured: isFeatured === true,
        isTrending: isTrending === true,
        compliance,
      },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create product' }, { status: 500 })
  }
}

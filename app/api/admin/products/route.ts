import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ]
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: products })
  } catch (error) {
    console.error('Admin products GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch products' }, { status: 500 })
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

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { productId: string } }) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      include: { category: true },
    })
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { productId: string } }) {
  try {
    const body = await request.json()
    const {
      name, slug, description, shortDesc,
      price, comparePrice, costPrice, wholesalePrice, vipPrice,
      weight, images, sku, barcode, inventory,
      categoryIds, isActive, isFeatured, isTrending,
      minOrderQty, lowStockAlert
    } = body

    const product = await prisma.product.update({
      where: { id: params.productId },
      data: {
        name, slug, description,
        shortDesc: shortDesc || null,
        price: parseFloat(price) || 0,
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        vipPrice: vipPrice ? parseFloat(vipPrice) : null,
        weight: weight ? parseFloat(weight) : null,
        images: Array.isArray(images) ? JSON.stringify(images) : images,
        sku, barcode,
        inventory: parseInt(inventory) || 0,
        categoryIds: categoryIds ? JSON.stringify(categoryIds) : null,
        isActive,
        isFeatured,
        isTrending,
        minOrderQty: parseInt(minOrderQty) || 1,
        lowStockAlert: parseInt(lowStockAlert) || 10,
      },
    })
    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { productId: string } }) {
  try {
    await prisma.product.delete({ where: { id: params.productId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 })
  }
}

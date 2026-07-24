import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: { category: true },
    })
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const {
      name, slug, description, shortDesc, price, comparePrice, costPrice,
      wholesalePrice, vipPrice, minOrderQty, weight, dimensions, images,
      modelImage, sizeChart, sku, barcode, inventory, lowStockAlert,
      categoryId, tags, isActive, isFeatured, isTrending, compliance
    } = body

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name, slug, description, shortDesc,
        price: parseFloat(price),
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        vipPrice: vipPrice ? parseFloat(vipPrice) : null,
        minOrderQty: parseInt(minOrderQty) || 1,
        weight: weight ? parseFloat(weight) : null,
        dimensions, images: Array.isArray(images) ? JSON.stringify(images) : images,
        modelImage, sizeChart, sku, barcode,
        inventory: parseInt(inventory) || 0,
        lowStockAlert: parseInt(lowStockAlert) || 10,
        categoryId, tags,
        isActive: isActive !== undefined ? isActive : true,
        isFeatured: isFeatured === true,
        isTrending: isTrending === true,
        compliance,
      },
    })
    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.product.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 })
  }
}

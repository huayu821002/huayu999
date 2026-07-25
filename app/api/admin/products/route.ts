import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const products = await prisma.product.findMany()
    return NextResponse.json({ success: true, data: products })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, slug, description, price, comparePrice, costPrice, weight, images, sku, barcode, inventory, categoryId, isActive } = body

    const product = await prisma.product.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
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
        isActive: isActive !== false,
      },
    })
    return NextResponse.json({ success: true, data: product })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

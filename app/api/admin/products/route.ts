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
    const { name, slug, description, price, images, sku, categoryId, status } = body

    const product = await prisma.product.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        price: parseFloat(price) || 0,
        images: typeof images === 'string' ? images : JSON.stringify(images),
        sku,
        categoryId,
        status: status || 'ACTIVE',
      },
    })
    return NextResponse.json({ success: true, data: product })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

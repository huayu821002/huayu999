import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { productId: string } }) {
  try {
    const variants = await prisma.productVariant.findMany({
      where: { productId: params.productId },
    })
    return NextResponse.json({ success: true, data: variants })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch variants' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { productId: string } }) {
  try {
    const body = await request.json()
    const { name, value, sku, price, inventory, image } = body

    const variant = await prisma.productVariant.create({
      data: {
        productId: params.productId,
        name,
        value,
        sku: sku || null,
        price: price ? parseFloat(price) : null,
        inventory: parseInt(inventory) || 0,
        image: image || null,
      },
    })
    return NextResponse.json({ success: true, data: variant })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Failed to create variant' }, { status: 500 })
  }
}

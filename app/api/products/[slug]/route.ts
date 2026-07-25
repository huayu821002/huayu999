import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // First try to find product without variants
    const product = await prisma.product.findUnique({
      where: { slug: params.slug },
      include: { category: true },
    })

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }

    // Then try to get variants separately
    let variants: any[] = []
    try {
      variants = await prisma.productVariant.findMany({
        where: { productId: product.id },
      })
    } catch (e) {
      console.error('Variants query error:', e)
      // Continue without variants if this fails
    }

    return NextResponse.json({ 
      success: true, 
      data: { ...product, variants } 
    })
  } catch (error) {
    console.error('Product API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 })
  }
}

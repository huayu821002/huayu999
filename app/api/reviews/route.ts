import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET reviews for a product
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 })
    }

    const reviews = await prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: reviews })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create a review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, userId, rating, comment } = body

    if (!productId || !userId || !rating) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Create review
    const review = await prisma.review.create({
      data: { productId, userId, rating, comment }
    })

    // Update product's average rating and review count
    const allReviews = await prisma.review.findMany({
      where: { productId },
      select: { rating: true }
    })

    const reviewCount = allReviews.length
    const averageRating = allReviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount

    await prisma.product.update({
      where: { id: productId },
      data: {
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount
      }
    })

    return NextResponse.json({ success: true, data: review })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

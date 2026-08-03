import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// Extract user from Authorization header
async function getUserFromRequest(request: Request): Promise<{ userId: string; role: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  return verifyToken(token)
}

// Check if user has ordered a specific product
async function hasUserOrderedProduct(userId: string, productId: string): Promise<boolean> {
  const order = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: {
        userId,
        status: { in: ['PROCESSING', 'SHIPPED', 'DELIVERED'] },
      },
    },
  })
  return order !== null
}

// GET reviews for a product, or check review permission
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const action = searchParams.get('action')

    // Permission check: GET /api/reviews/check?productId=xxx
    if (action === 'check' && productId) {
      const user = await getUserFromRequest(request)
      if (!user) return NextResponse.json({ success: false, canReview: false, error: 'Unauthorized' }, { status: 401 })

      // Admins can always review
      if (user.role === 'ADMIN') {
        return NextResponse.json({ success: true, canReview: true })
      }

      const hasOrdered = await hasUserOrderedProduct(user.userId, productId)
      return NextResponse.json({ success: true, canReview: hasOrdered })
    }

    // Get reviews list
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
    const { productId, rating, comment } = body

    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!productId || !rating) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Check permission: admin OR customer who has ordered this product
    if (user.role !== 'ADMIN') {
      const hasOrdered = await hasUserOrderedProduct(user.userId, productId)
      if (!hasOrdered) {
        return NextResponse.json(
          { success: false, error: 'You must purchase this product before reviewing it' },
          { status: 403 }
        )
      }
    }

    // Create review
    const review = await prisma.review.create({
      data: { productId, userId: user.userId, rating, comment }
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

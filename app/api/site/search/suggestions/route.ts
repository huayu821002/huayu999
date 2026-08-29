import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const HOT_KEYWORDS = ['trending', 'pet', 'accessories', 'gift', 'home decor', 'new arrival']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''

    if (q.length < 2) {
      return NextResponse.json({ success: true, data: { products: [], categories: [], hotKeywords: HOT_KEYWORDS } })
    }

    // 搜索产品（名称、描述、SKU）
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
          { sku: { contains: q } },
        ],
      },
      take: 6,
      select: {
        id: true,
        name: true,
        price: true,
        comparePrice: true,
        images: true,
        slug: true,
        categories: { select: { name: true, slug: true } },
      },
    })

    // 搜索分类
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { slug: { contains: q } },
        ],
      },
      take: 4,
      select: { id: true, name: true, slug: true, image: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        products,
        categories,
        hotKeywords: HOT_KEYWORDS,
      },
    })
  } catch (error) {
    console.error('Search suggestions error:', error)
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 })
  }
}

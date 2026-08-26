import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET all categories with sub-categories (2-level hierarchy)
export async function GET() {
  try {
    const parentCategories = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      include: {
        children: { orderBy: { name: 'asc' } },
        _count: { select: { products: true } }
      }
    })

    if (parentCategories.length === 0) {
      return NextResponse.json({ success: true, data: getDefaultCategories() })
    }

    const result = parentCategories.map(cat => ({
      ...cat,
      productCount: cat._count.products,
      children: cat.children.map(child => ({ ...child, productCount: 0 }))
    }))

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Category fetch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 })
  }
}

function getDefaultCategories() {
  return [
    { id: 'cat-1', name: 'Accessories', slug: 'accessories', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600', productCount: 0, children: [
      { id: 'sub-1', name: 'Jewelry', slug: 'jewelry', productCount: 0 },
      { id: 'sub-2', name: 'Bags', slug: 'bags', productCount: 0 },
      { id: 'sub-3', name: 'Hats', slug: 'hats', productCount: 0 },
    ]},
    { id: 'cat-2', name: 'Pet Supplies', slug: 'pet-supplies', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600', productCount: 0, children: [
      { id: 'sub-4', name: 'Pet Toys', slug: 'pet-toys', productCount: 0 },
      { id: 'sub-5', name: 'Pet Food', slug: 'pet-food', productCount: 0 },
      { id: 'sub-6', name: 'Pet Care', slug: 'pet-care', productCount: 0 },
    ]},
    { id: 'cat-3', name: 'Home Decor', slug: 'home-decor', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600', productCount: 0, children: [
      { id: 'sub-7', name: 'Wall Art', slug: 'wall-art', productCount: 0 },
      { id: 'sub-8', name: 'Candles', slug: 'candles', productCount: 0 },
      { id: 'sub-9', name: 'Vases', slug: 'vases', productCount: 0 },
    ]},
    { id: 'cat-4', name: 'Gifts', slug: 'gifts', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600', productCount: 0, children: [
      { id: 'sub-10', name: 'Birthday', slug: 'birthday', productCount: 0 },
      { id: 'sub-11', name: 'Holiday', slug: 'holiday', productCount: 0 },
      { id: 'sub-12', name: 'Wedding', slug: 'wedding', productCount: 0 },
    ]},
  ]
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET homepage categories for storefront
export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_categories' }
    })
    
    if (setting?.value) {
      return NextResponse.json(
      { success: true, data: JSON.parse(setting.value) },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
    }
    
    // Return default if no settings
    return NextResponse.json({ success: true, data: [
      { id: 'cat-1', name: 'Accessories', slug: 'accessories', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400' },
      { id: 'cat-2', name: 'Pet Supplies', slug: 'pet-supplies', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400' },
      { id: 'cat-3', name: 'Home Decor', slug: 'home-decor', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400' },
      { id: 'cat-4', name: 'Gifts', slug: 'gifts', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400' },
    ]})
  } catch (error) {
    return NextResponse.json({ success: true, data: [] })
  }
}

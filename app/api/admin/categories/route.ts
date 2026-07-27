import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET homepage categories settings
export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_categories' }
    })
    
    if (setting?.value) {
      return NextResponse.json({ success: true, data: JSON.parse(setting.value) })
    }
    
    // Return default categories if no settings exist
    return NextResponse.json({ success: true, data: getDefaultCategories() })
  } catch (error) {
    return NextResponse.json({ success: true, data: getDefaultCategories() })
  }
}

// POST save categories settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    await prisma.siteSetting.upsert({
      where: { key: 'homepage_categories' },
      update: { value: JSON.stringify(body) },
      create: { key: 'homepage_categories', value: JSON.stringify(body) }
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

function getDefaultCategories() {
  return [
    { id: 'cat-1', name: 'Accessories', slug: 'accessories', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400' },
    { id: 'cat-2', name: 'Pet Supplies', slug: 'pet-supplies', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400' },
    { id: 'cat-3', name: 'Home Decor', slug: 'home-decor', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400' },
    { id: 'cat-4', name: 'Gifts', slug: 'gifts', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400' },
  ]
}

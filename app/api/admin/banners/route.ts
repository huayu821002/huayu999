import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_banners' }
    })
    
    const banners = setting ? JSON.parse(setting.value) : []
    return NextResponse.json({ success: true, data: banners })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch banners' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const banners = body.banners

    if (!Array.isArray(banners)) {
      return NextResponse.json({ error: 'Banners must be an array' }, { status: 400 })
    }

    // Validate each banner
    for (const banner of banners) {
      if (!banner.image) {
        return NextResponse.json({ error: 'Each banner must have an image' }, { status: 400 })
      }
    }

    // Max 5 banners
    if (banners.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 banners allowed' }, { status: 400 })
    }

    const setting = await prisma.siteSetting.upsert({
      where: { key: 'homepage_banners' },
      update: { value: JSON.stringify(banners) },
      create: { key: 'homepage_banners', value: JSON.stringify(banners) }
    })

    return NextResponse.json({ success: true, data: JSON.parse(setting.value) })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to save banners' }, { status: 500 })
  }
}

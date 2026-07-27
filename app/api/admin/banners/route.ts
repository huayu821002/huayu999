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
      return NextResponse.json({ success: false, error: 'Banners must be an array' }, { status: 400 })
    }

    // Validate each banner has image
    for (const banner of banners) {
      if (!banner.image) {
        return NextResponse.json({ success: false, error: 'Each banner must have an image' }, { status: 400 })
      }
    }

    // Max 5 banners
    if (banners.length > 5) {
      return NextResponse.json({ success: false, error: 'Maximum 5 banners allowed' }, { status: 400 })
    }

    const jsonValue = JSON.stringify(banners)
    
    // Check if record exists first
    const existing = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_banners' }
    })
    
    let setting
    if (existing) {
      setting = await prisma.siteSetting.update({
        where: { key: 'homepage_banners' },
        data: { value: jsonValue }
      })
    } else {
      setting = await prisma.siteSetting.create({
        data: { key: 'homepage_banners', value: jsonValue }
      })
    }

    return NextResponse.json({ success: true, data: JSON.parse(setting.value) })
  } catch (error: any) {
    console.error('Save banner error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to save banners' }, { status: 500 })
  }
}

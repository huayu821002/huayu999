import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_banners' }
    })
    
    const banners = setting ? JSON.parse(setting.value) : []
    return NextResponse.json({ success: true, data: banners })
  } catch (error) {
    return NextResponse.json({ success: true, data: [] })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepage_banners' }
    })
    
    const banners = setting ? JSON.parse(setting.value) : []
    return NextResponse.json(
      { success: true, data: banners },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        }
      }
    )
  } catch (error) {
    return NextResponse.json({ success: true, data: [] })
  }
}

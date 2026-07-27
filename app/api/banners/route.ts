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
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
        }
      }
    )
  } catch (error) {
    return NextResponse.json({ success: true, data: [] })
  }
}

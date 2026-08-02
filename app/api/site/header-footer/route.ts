import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ['header_settings', 'footer_settings'] } }
    })
    
    const result: any = {
      header: null,
      footer: null
    }
    
    for (const s of settings) {
      if (s.key === 'header_settings') {
        result.header = JSON.parse(s.value)
      } else if (s.key === 'footer_settings') {
        result.footer = JSON.parse(s.value)
      }
    }
    
    return NextResponse.json({ success: true, data: result }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 })
  }
}

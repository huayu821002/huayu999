import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/site/seo?pageType=category&pageSlug=party-supplies&locale=en
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageType = searchParams.get('pageType') || 'homepage'
    const pageSlug = searchParams.get('pageSlug') || 'homepage'
    const locale = searchParams.get('locale') || 'en'

    const setting = await prisma.seoSetting.findUnique({
      where: {
        pageType_pageSlug_locale: {
          pageType,
          pageSlug,
          locale,
        }
      }
    })

    if (setting) {
      return NextResponse.json({ success: true, data: setting })
    }

    // Fallback: try English if not found
    if (locale !== 'en') {
      const fallback = await prisma.seoSetting.findUnique({
        where: {
          pageType_pageSlug_locale: {
            pageType,
            pageSlug,
            locale: 'en',
          }
        }
      })
      if (fallback) return NextResponse.json({ success: true, data: fallback })
    }

    return NextResponse.json({ success: true, data: null })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

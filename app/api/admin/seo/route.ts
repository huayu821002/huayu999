import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/seo?pageType=category&pageSlug=party-supplies&locale=en
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageType = searchParams.get('pageType')
    const pageSlug = searchParams.get('pageSlug')
    const locale = searchParams.get('locale') || 'en'

    if (!pageType) {
      // Return all SEO settings grouped
      const settings = await prisma.seoSetting.findMany({
        orderBy: [{ pageType: 'asc' }, { pageSlug: 'asc' }],
      })
      return NextResponse.json({ success: true, data: settings })
    }

    const setting = await prisma.seoSetting.findUnique({
      where: {
        pageType_pageSlug_locale: {
          pageType,
          pageSlug: pageSlug || '',
          locale,
        }
      }
    })

    return NextResponse.json({ success: true, data: setting })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST /api/admin/seo - create or update SEO setting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pageType, pageSlug, locale = 'en', title, description, keywords, ogTitle, ogDescription, canonicalUrl } = body

    if (!pageType) {
      return NextResponse.json({ success: false, error: 'pageType is required' }, { status: 400 })
    }

    const slug = pageSlug || pageType // homepage uses pageType as slug

    const setting = await prisma.seoSetting.upsert({
      where: {
        pageType_pageSlug_locale: {
          pageType,
          pageSlug: slug,
          locale,
        }
      },
      update: {
        title,
        description,
        keywords,
        ogTitle,
        ogDescription,
        canonicalUrl,
      },
      create: {
        pageType,
        pageSlug: slug,
        locale,
        title: title || '',
        description: description || '',
        keywords: keywords || '',
        ogTitle: ogTitle || '',
        ogDescription: ogDescription || '',
        canonicalUrl: canonicalUrl || '',
      }
    })

    return NextResponse.json({ success: true, data: setting })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE /api/admin/seo?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })

    await prisma.seoSetting.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

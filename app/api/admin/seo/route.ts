import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const defaultSeo = {
  title: 'Huayu Wholesale | B2B Cross-border E-commerce Platform',
  description: 'B2B small wholesale platform for high-quality accessories, pet supplies, creative novelty gifts, and home décor. $50 minimum mixed order. Ships worldwide.',
  keywords: 'wholesale, Yiwu accessories, pet supplies, novelty gifts, B2B, small wholesale, cross-border e-commerce',
  ogImage: '',
}

export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'seo_settings' }
    })
    if (setting?.value) {
      return NextResponse.json({ success: true, data: JSON.parse(setting.value) })
    }
    return NextResponse.json({ success: true, data: defaultSeo })
  } catch (error) {
    return NextResponse.json({ success: true, data: defaultSeo })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const seo = {
      title: body.title || defaultSeo.title,
      description: body.description || defaultSeo.description,
      keywords: body.keywords || defaultSeo.keywords,
      ogImage: body.ogImage || defaultSeo.ogImage,
    }
    await prisma.siteSetting.upsert({
      where: { key: 'seo_settings' },
      update: { value: JSON.stringify(seo) },
      create: { key: 'seo_settings', value: JSON.stringify(seo) }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

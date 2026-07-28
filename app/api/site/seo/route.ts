import { NextResponse } from 'next/server'
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

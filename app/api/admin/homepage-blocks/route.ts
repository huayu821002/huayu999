import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET homepage blocks settings
export async function GET() {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ['homepage_trust_badges', 'footer_promo'] } }
    })
    
    const result: any = {}
    for (const s of settings) {
      if (s.key === 'homepage_trust_badges') {
        result.trustBadges = JSON.parse(s.value)
      } else if (s.key === 'footer_promo') {
        result.footerPromo = JSON.parse(s.value)
      }
    }
    
    if (!result.trustBadges) {
      result.trustBadges = [
        { icon: 'ShieldCheck', title: 'Quality Assured', desc: 'Every product inspected before shipping' },
        { icon: 'Truck', title: 'Global Shipping', desc: '150+ countries supported' },
        { icon: 'Package', title: 'Low Minimums', desc: 'Order from just 3 units' },
        { icon: 'RefreshCw', title: 'Easy Returns', desc: '30-day hassle-free returns' },
      ]
    }
    if (!result.footerPromo) {
      result.footerPromo = {
        title: '🎉 Special Offer',
        subtitle: 'Follow us for exclusive deals and new arrivals',
        social: ['Instagram', 'Facebook', 'Twitter', 'YouTube', 'TikTok']
      }
    }
    
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json({ success: true, data: {} })
  }
}

// POST save homepage blocks settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (body.trustBadges) {
      await prisma.siteSetting.upsert({
        where: { key: 'homepage_trust_badges' },
        update: { value: JSON.stringify(body.trustBadges) },
        create: { key: 'homepage_trust_badges', value: JSON.stringify(body.trustBadges) }
      })
    }
    
    if (body.footerPromo) {
      await prisma.siteSetting.upsert({
        where: { key: 'footer_promo' },
        update: { value: JSON.stringify(body.footerPromo) },
        create: { key: 'footer_promo', value: JSON.stringify(body.footerPromo) }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

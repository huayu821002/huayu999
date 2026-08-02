import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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
    
    // Return defaults if not set
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
    
    return NextResponse.json({ success: true, data: result }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
    })
  } catch (error) {
    return NextResponse.json({ 
      success: true, 
      data: {
        trustBadges: [
          { icon: 'ShieldCheck', title: 'Quality Assured', desc: 'Every product inspected before shipping' },
          { icon: 'Truck', title: 'Global Shipping', desc: '150+ countries supported' },
          { icon: 'Package', title: 'Low Minimums', desc: 'Order from just 3 units' },
          { icon: 'RefreshCw', title: 'Easy Returns', desc: '30-day hassle-free returns' },
        ],
        footerPromo: {
          title: '🎉 Special Offer',
          subtitle: 'Follow us for exclusive deals and new arrivals',
          social: ['Instagram', 'Facebook', 'Twitter', 'YouTube', 'TikTok']
        }
      }
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
    })
  }
}

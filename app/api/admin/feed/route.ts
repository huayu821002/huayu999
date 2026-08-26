import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/feed - Google Merchant Center XML feed
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
      },
      take: 10000, // GMC limit
    })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fiestaflare.com'

    const items = products.map(p => {
      const images: string[] = (() => {
        if (!p.images) return []
        if (Array.isArray(p.images)) return p.images
        try { return JSON.parse(p.images as string) } catch { return [p.images as string] }
      })()

      const title = p.name.replace(/[<>&'"]/g, '')
      const description = (p.description || p.shortDesc || '').replace(/[<>&'"]/g, '').substring(0, 5000)
      const imageLink = images[0] || ''
      const link = `${siteUrl}/products/${p.slug}`
      const price = `${p.price.toFixed(2)} USD`
      const availability = p.inventory > 0 ? 'in stock' : 'out of stock'
      const category = p.category?.name || ''

      return {
        id: p.id,
        title,
        description,
        imageLink,
        link,
        price,
        availability,
        ...(category && { googleProductCategory: category }),
        ...(p.sku && { mpn: p.sku }),
        brand: { '@': 'Fiestaflare' },
        condition: 'new',
        gtin: p.barcode || undefined,
      }
    })

    // Generate RSS-style XML for Google Merchant Center
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Fiestaflare Wholesale</title>
    <link>${siteUrl}</link>
    <description>Wholesale products from Fiestaflare</description>
    ${items.map(item => `
    <item>
      <g:id>${item.id}</g:id>
      <g:title>${item.title}</g:title>
      <g:description>${item.description}</g:description>
      <g:link>${item.link}</g:link>
      <g:image_link>${item.imageLink}</g:image_link>
      <g:price>${item.price}</g:price>
      <g:availability>${item.availability}</g:availability>
      <g:condition>${item.condition}</g:condition>
      <g:brand>${item.brand['@']}</g:brand>
      ${item.gtin ? `<g:gtin>${item.gtin}</g:gtin>` : ''}
      ${item.mpn ? `<g:mpn>${item.mpn}</g:mpn>` : ''}
    </item>`).join('')}
  </channel>
</rss>`

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'max-age=0, s-maxage=3600',
      }
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

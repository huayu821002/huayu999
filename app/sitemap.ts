import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://fiestaflare.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  // Get products from DB
  let products: { slug: string; updatedAt: Date | null }[] = []
  try {
    products = await prisma.product.findMany({
      select: { slug: true, updatedAt: true },
      where: { isActive: true },
    })
  } catch (e) {
    console.error('Sitemap: failed to fetch products', e)
  }

  const productPages: MetadataRoute.Sitemap = products.map(p => ({
    url: `${baseUrl}/products/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticPages, ...productPages]
}

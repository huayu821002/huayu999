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

  // Category pages (parent categories only)
  let categories: { slug: string; updatedAt: Date | null }[] = []
  try {
    categories = await prisma.category.findMany({
      select: { slug: true, updatedAt: true },
      where: { parentId: null },
    })
  } catch (e) {
    console.error('Sitemap: failed to fetch categories', e)
  }

  const categoryPages: MetadataRoute.Sitemap = categories.map(c => ({
    url: `${baseUrl}/categories/${c.slug}`,
    lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Child categories
  let childCategories: { slug: string; updatedAt: Date | null }[] = []
  try {
    childCategories = await prisma.category.findMany({
      select: { slug: true, updatedAt: true },
      where: { NOT: { parentId: null } },
    })
  } catch (e) {}

  const childCategoryPages: MetadataRoute.Sitemap = childCategories.map(c => ({
    url: `${baseUrl}/categories/${c.slug}`,
    lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

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

  return [...staticPages, ...categoryPages, ...childCategoryPages, ...productPages]
}

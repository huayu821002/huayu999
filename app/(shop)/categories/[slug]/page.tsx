import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CategoryClient } from './CategoryClient'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://fiestaflare.com'

interface Props {
  params: { slug: string }
  searchParams: { page?: string; sort?: string; collection?: string }
}

// Fetch category SEO from SeoSetting or build defaults
async function getCategorySeo(slug: string, name: string) {
  try {
    const setting = await prisma.seoSetting.findUnique({
      where: { pageType_pageSlug_locale: { pageType: 'category', pageSlug: slug, locale: 'en' } }
    })
    if (setting && setting.title) return setting
  } catch {}

  // Build defaults
  const title = `${name} Wholesale | Bulk ${name} Supplier - Fiestaflare`
  const description = `Sourcing ${name.toLowerCase()} wholesale directly from Yiwu China factories. ${name} at factory prices with low MOQ from 3 units. Dropshipping available. Ships to USA, Brazil & worldwide.`
  return { title, description, keywords: name.toLowerCase() + ' wholesale, ' + name.toLowerCase() + ' bulk', ogTitle: '', ogDescription: '', canonicalUrl: '' }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params

  // Fetch category from DB
  let category: { name: string; slug: string; description?: string | null; image?: string | null; parent?: { name: string; slug: string } | null } | null = null
  try {
    category = await prisma.category.findUnique({
      where: { slug },
      include: { parent: true }
    })
  } catch {}

  if (!category) {
    // Try to get name from URL slug for title only
    return { title: `${slug} - Fiestaflare`, description: 'Browse our collection' }
  }

  const seo = await getCategorySeo(slug, category.name)
  const canonical = seo.canonicalUrl || `${SITE_URL}/categories/${slug}`

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical,
      languages: {
        'en-US': `${SITE_URL}/categories/${slug}?locale=en`,
        'pt-BR': `${SITE_URL}/pt/categories/${slug}`,
        'ru-RU': `${SITE_URL}/ru/categories/${slug}`,
      }
    },
    openGraph: {
      title: seo.ogTitle || seo.title,
      description: seo.ogDescription || seo.description,
      type: 'website',
      locale: 'en_US',
      images: category.image ? [{ url: category.image, width: 600, height: 400 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.ogTitle || seo.title,
      description: seo.ogDescription || seo.description,
    }
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = params
  const page = parseInt(searchParams.page || '1')
  const sort = searchParams.sort || 'featured'

  // Fetch category with children and products
  let category: any = null
  let products: any[] = []
  let totalCount = 0

  try {
    category = await prisma.category.findUnique({
      where: { slug },
      include: {
        children: { orderBy: { name: 'asc' } },
        parent: true,
      }
    })

    if (!category) {
      // Try to find as child category
      category = await prisma.category.findUnique({
        where: { slug },
        include: {
          children: { orderBy: { name: 'asc' } },
          parent: true,
        }
      })
    }
  } catch (error) {
    console.error('Category fetch error:', error)
  }

  if (!category) notFound()

  // Build sort options
  const sortOptions: Record<string, any> = {
    featured: { isFeatured: 'desc' },
    newest: { createdAt: 'desc' },
    'price-low': { price: 'asc' },
    'price-high': { price: 'desc' },
    'name-az': { name: 'asc' },
  }
  const orderBy = sortOptions[sort] || {}

  // Fetch products for this category
  try {
    const where = {
      isActive: true,
      OR: [
        { categoryId: category.id },
        { category: { parentId: category.id } },
      ]
    }
    const [productsResult] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * 24,
        take: 24,
      }),
      prisma.product.count({ where }),
    ])
    products = productsResult
  } catch (error) {
    console.error('Products fetch error:', error)
  }

  // Build JSON-LD structured data
  const categoryJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    description: category.description || `${category.name} wholesale collection`,
    url: `${SITE_URL}/categories/${slug}`,
    ...(category.image && { image: category.image }),
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        ...(category.parent ? [{ '@type': 'ListItem', position: 2, name: category.parent.name, item: `${SITE_URL}/categories/${category.parent.slug}` }] : []),
        { '@type': 'ListItem', position: category.parent ? 3 : 2, name: category.name, item: `${SITE_URL}/categories/${slug}` },
      ]
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
      />
      <CategoryClient
        category={category}
        initialProducts={products}
        currentSort={sort}
        currentPage={page}
      />
    </>
  )
}

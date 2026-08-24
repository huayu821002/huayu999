import type { Metadata } from 'next'

async function getSeoSettings() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fiestaflare.com'
    const res = await fetch(`${baseUrl}/api/site/seo`, {
      cache: 'no-store'
    })
    const data = await res.json()
    return data.data || {}
  } catch {
    return {}
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings()
  return {
    title: {
      default: seo.title || 'Huayu Wholesale | B2B Cross-border E-commerce Platform',
      template: '%s | Huayu Wholesale',
    },
    description: seo.description || '',
    keywords: seo.keywords || '',
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: 'Huayu Wholesale',
      title: seo.title,
      description: seo.description,
      images: seo.ogImage ? [{ url: seo.ogImage }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: seo.ogImage ? [seo.ogImage] : [],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

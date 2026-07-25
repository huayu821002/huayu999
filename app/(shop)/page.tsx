'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProductCard } from '@/components/shop/ProductCard'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  comparePrice?: number | null
  images?: string | null
  category?: { name: string } | null
  description?: string
  minOrderQty?: number
  sku?: string
  inventory?: number
}

interface SiteContent {
  key: string
  value: any
}

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [newArrivalProducts, setNewArrivalProducts] = useState<Product[]>([])
  const [siteContent, setSiteContent] = useState<Record<string, SiteContent>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
    fetchSiteContent()
  }, [])

  const fetchProducts = async () => {
    try {
      const allRes = await fetch('/api/products')
      const allData = await allRes.json()
      if (allData.success && allData.data) {
        setFeaturedProducts(allData.data.slice(0, 8))
        setNewArrivalProducts(allData.data.slice(0, 8))
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSiteContent = async () => {
    try {
      const res = await fetch('/api/admin/site-content')
      const data = await res.json()
      if (data.success && data.data) {
        const contentMap: Record<string, SiteContent> = {}
        data.data.forEach((item: SiteContent) => { contentMap[item.key] = item })
        setSiteContent(contentMap)
      }
    } catch (err) { console.error('Failed to fetch site content:', err) }
  }

  const sc = (key: string) => siteContent[key]?.value

  const renderSection = (title: string, subtitle: string, products: Product[]) => {
    if (products.length === 0) return null
    return (
      <section className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-joy-gray-900">{title}</h2>
          <p className="text-joy-gray-500 mt-2">{subtitle}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product as any} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      
      {/* Hero */}
      <section className="bg-gradient-to-r from-joy-orange to-orange-400 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{sc('hero_title') || 'Wholesale Products'}</h1>
          <p className="text-xl opacity-90 mb-8">{sc('hero_subtitle') || 'Best prices for bulk orders'}</p>
          <Link href="/products" className="inline-block bg-white text-joy-orange px-8 py-3 rounded-full font-semibold hover:bg-orange-50 transition">Shop Now</Link>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
        ) : (
          <>
            {renderSection(sc('featured_title')?.title || 'Featured Products', sc('featured_title')?.subtitle || 'Handpicked bestsellers', featuredProducts)}
            {renderSection(sc('new_arrivals_title')?.title || 'New Arrivals', sc('new_arrivals_title')?.subtitle || 'Fresh products', newArrivalProducts)}
            {!isLoading && featuredProducts.length === 0 && newArrivalProducts.length === 0 && (
              <div className="text-center py-16 text-joy-gray-500">
                <p>No products available yet.</p>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

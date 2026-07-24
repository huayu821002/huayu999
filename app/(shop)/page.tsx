'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { SubscribeModal } from '@/components/shop/SubscribeModal'
import { ProductCard } from '@/components/shop/ProductCard'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types'

const FEATURED_PRODUCTS: Product[] = []
const TRENDING_PRODUCTS: Product[] = []

const CATEGORIES = [
  { id: 'cat-1', name: 'Accessories', slug: 'accessories', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400', count: 0 },
  { id: 'cat-2', name: 'Pet Supplies', slug: 'pet-supplies', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', count: 0 },
  { id: 'cat-3', name: 'Home Decor', slug: 'home-decor', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', count: 0 },
  { id: 'cat-4', name: 'Gifts', slug: 'gifts', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400', count: 0 },
]

const TRUST_BADGES = [
  { icon: Icons.ShieldCheck, title: 'Quality Assured', desc: 'Every product inspected before shipping' },
  { icon: Icons.Truck, title: 'Global Shipping', desc: '150+ countries supported' },
  { icon: Icons.Package, title: 'Low Minimums', desc: 'Order from just 3 units' },
  { icon: Icons.RefreshCw, title: 'Easy Returns', desc: '30-day hassle-free returns' },
]

export default function ShopHomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?featured=true')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setFeaturedProducts(data.data.slice(0, 8))
      } else {
        const allRes = await fetch('/api/products')
        const allData = await allRes.json()
        if (allData.success) {
          setFeaturedProducts(allData.data.slice(0, 8))
          setTrendingProducts(allData.data.filter((p: Product) => p.isTrending).slice(0, 4))
        }
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-joy-gray-900 via-joy-gray-800 to-joy-gray-900 text-white py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4">
            <div className="max-w-2xl">
              <h1 className="font-display text-4xl md:text-6xl font-bold mb-6">
                Wholesale Products from Yiwu
                <span className="block text-joy-orange">Direct from Factory</span>
              </h1>
              <p className="text-lg text-joy-gray-300 mb-8">
                No middlemen. No markups. Just factory-direct pricing on 50,000+ products with shipping to 150+ countries.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/products">
                  <Button size="lg" className="bg-joy-orange hover:bg-joy-orange/90 text-white">
                    Browse Products
                  </Button>
                </Link>
                <Button size="lg" variant="secondary">
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Badges */}
        <section className="bg-joy-gray-50 py-8 border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {TRUST_BADGES.map((badge) => (
                <div key={badge.title} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-joy-orange/10 flex items-center justify-center flex-shrink-0">
                    <badge.icon size={20} className="text-joy-orange" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-joy-gray-900">{badge.title}</p>
                    <p className="text-xs text-joy-gray-500">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-2xl font-bold text-joy-gray-900">Shop by Category</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {CATEGORIES.map((cat) => (
                <Link key={cat.id} href={`/products?category=${cat.slug}`} className="group relative rounded-2xl overflow-hidden aspect-[4/3]">
                  <Image src={cat.image} alt={cat.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="font-semibold text-lg text-white">{cat.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-16 bg-joy-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-joy-gray-900">Featured Products</h2>
                <p className="text-joy-gray-500 mt-1">Handpicked bestsellers at wholesale prices</p>
              </div>
              <Link href="/products">
                <Button variant="secondary">
                  Browse All <Icons.ChevronRight size={18} className="ml-1" />
                </Button>
              </Link>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
                ))}
              </div>
            ) : featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {featuredProducts.slice(0, 8).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-joy-gray-500">
                <Icons.Package size={48} className="mx-auto mb-4 opacity-30" />
                <p>No products yet. Add products from the admin panel.</p>
                <Link href="/admin/dashboard" className="text-joy-orange hover:underline mt-2 inline-block">Go to Admin</Link>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
      </main>
      <Footer />
      <FloatingButtons />
      <CartDrawer />
      <SubscribeModal />
    </div>
  )
}

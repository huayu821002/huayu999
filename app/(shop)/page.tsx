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
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import type { Product } from '@/types'

interface SiteContent {
  section: string
  title: string | null
  subtitle: string | null
  content: string | null
}

const defaultCategories = [
  { id: 'cat-1', name: 'Accessories', slug: 'accessories', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400', count: 0 },
  { id: 'cat-2', name: 'Pet Supplies', slug: 'pet-supplies', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', count: 0 },
  { id: 'cat-3', name: 'Home Decor', slug: 'home-decor', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', count: 0 },
  { id: 'cat-4', name: 'Gifts', slug: 'gifts', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400', count: 0 },
]

const defaultTrustBadges = [
  { icon: 'ShieldCheck', title: 'Quality Assured', desc: 'Every product inspected before shipping' },
  { icon: 'Truck', title: 'Global Shipping', desc: '150+ countries supported' },
  { icon: 'Package', title: 'Low Minimums', desc: 'Order from just 3 units' },
  { icon: 'RefreshCw', title: 'Easy Returns', desc: '30-day hassle-free returns' },
]

const TRUST_BADGES = [
  { icon: Icons.ShieldCheck, title: 'Quality Assured', desc: 'Every product inspected before shipping' },
  { icon: Icons.Truck, title: 'Global Shipping', desc: '150+ countries supported' },
  { icon: Icons.Package, title: 'Low Minimums', desc: 'Order from just 3 units' },
  { icon: Icons.RefreshCw, title: 'Easy Returns', desc: '30-day hassle-free returns' },
]

export default function ShopHomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [newArrivalProducts, setNewArrivalProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [siteContent, setSiteContent] = useState<Record<string, SiteContent>>({})
  const [categories, setCategories] = useState(defaultCategories)
  const [trustBadges, setTrustBadges] = useState(defaultTrustBadges)

  useEffect(() => {
    fetchProducts()
    fetchSiteContent()
    fetchCategories()
    fetchHomepageBlocks()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/site/categories')
      const data = await res.json()
      if (data.success && data.data) {
        setCategories(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  const fetchHomepageBlocks = async () => {
    try {
      const res = await fetch('/api/site/homepage-blocks')
      const data = await res.json()
      if (data.success && data.data) {
        if (data.data.trustBadges) {
          setTrustBadges(data.data.trustBadges)
        }
      }
    } catch (err) {
      console.error('Failed to fetch homepage blocks:', err)
    }
  }

  const fetchProducts = async () => {
    try {
      // Fetch featured products
      const featuredRes = await fetch('/api/products?featured=true')
      const featuredData = await featuredRes.json()
      if (featuredData.success && featuredData.data.length > 0) {
        setFeaturedProducts(featuredData.data.slice(0, 8))
      } else {
        const allRes = await fetch('/api/products')
        const allData = await allRes.json()
        if (allData.success) {
          setFeaturedProducts(allData.data.slice(0, 8))
        }
      }

      // Fetch new arrivals (products created in last 30 days)
      const allRes = await fetch('/api/products')
      const allData = await allRes.json()
      if (allData.success) {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const newProducts = allData.data.filter((p: any) => 
          p.createdAt && new Date(p.createdAt) >= thirtyDaysAgo
        )
        setNewArrivalProducts(newProducts.slice(0, 8))
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
      if (data.success) {
        const contentMap: Record<string, SiteContent> = {}
        data.data.forEach((item: SiteContent) => { contentMap[item.section] = item })
        setSiteContent(contentMap)
      }
    } catch (err) { console.error('Failed to fetch site content:', err) }
  }

  const sc = (section: string) => siteContent[section]

  // Parse banners from site content
  let banners: { image: string; link: string; alt: string }[] = []
  try {
    if (sc('banners')?.content) banners = JSON.parse(sc('banners')!.content!)
  } catch {}

  // Check if new arrivals section is enabled
  const newArrivalEnabled = sc('new_arrivals')?.title !== 'false'
  const showNewArrivals = newArrivalEnabled && newArrivalProducts.length > 0

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        {/* Hero Carousel */}
        <HeroCarousel />

        {/* Trust Badges */}
        <section className="bg-joy-gray-50 py-8 border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {trustBadges.map((badge: any) => (
                <div key={badge.title} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-joy-orange/10 flex items-center justify-center flex-shrink-0">
                    {badge.icon === 'ShieldCheck' && <Icons.ShieldCheck size={20} className="text-joy-orange" />}
                    {badge.icon === 'Truck' && <Icons.Truck size={20} className="text-joy-orange" />}
                    {badge.icon === 'Package' && <Icons.Package size={20} className="text-joy-orange" />}
                    {badge.icon === 'RefreshCw' && <Icons.RefreshCw size={20} className="text-joy-orange" />}
                    {badge.icon === 'MessageCircle' && <Icons.MessageCircle size={20} className="text-joy-orange" />}
                    {badge.icon === 'Star' && <Icons.Star size={20} className="text-joy-orange" />}
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

        {/* New Arrivals Section */}
        {showNewArrivals && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-joy-orange text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                      NEW
                    </span>
                    <h2 className="font-display text-2xl font-bold text-joy-gray-900">
                      {sc('new_arrivals')?.title || 'New Arrivals'}
                    </h2>
                  </div>
                  <p className="text-joy-gray-500 mt-1">
                    {sc('new_arrivals')?.subtitle || 'Fresh from the factory - just landed!'}
                  </p>
                </div>
                <Link href="/products?sort=newest">
                  <Button variant="secondary">
                    View All <Icons.ChevronRight size={18} className="ml-1" />
                  </Button>
                </Link>
              </div>
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                  {newArrivalProducts.map((product) => (
                    <ProductCard key={product.id} product={product} isNew />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Categories */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-2xl font-bold text-joy-gray-900">
                {sc('category_title')?.title || 'Shop by Category'}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((cat) => (
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
                <h2 className="font-display text-2xl font-bold text-joy-gray-900">
                  {sc('featured_title')?.title || 'Featured Products'}
                </h2>
                <p className="text-joy-gray-500 mt-1">
                  {sc('featured_title')?.subtitle || 'Handpicked bestsellers at wholesale prices'}
                </p>
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
      </main>
      <Footer />
      <FloatingButtons />
      <CartDrawer />
      <SubscribeModal />
    </div>
  )
}

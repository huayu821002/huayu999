'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { ProductCard } from '@/components/shop/ProductCard'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/lib/store'
import type { Product, Category } from '@/types'

const CATEGORIES: Category[] = [
  { id: '1', name: 'Accessories', slug: 'accessories', productCount: 1250 },
  { id: '2', name: 'Pet Supplies', slug: 'pet-supplies', productCount: 890 },
  { id: '3', name: 'Creative Gifts', slug: 'gifts', productCount: 720 },
  { id: '4', name: 'Home Décor', slug: 'home-decor', productCount: 650 },
]

const MOCK_PRODUCTS: Product[] = [
  {
    id: '1', name: 'Yiwu Crystal Beaded Statement Necklace', slug: 'yiwu-crystal-beaded-necklace',
    description: 'Stunning crystal beaded necklace', price: 12.99, minOrderQty: 3, sku: 'AC-001',
    inventory: 150, images: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400'],
    category: { id: '1', name: 'Accessories', slug: 'accessories' }, isTrending: true,
  },
  {
    id: '2', name: 'Pet Collar with LED Light', slug: 'pet-collar-led-light',
    description: 'Safety LED collar', price: 15.99, minOrderQty: 5, sku: 'PET-002',
    inventory: 200, images: ['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400'],
    category: { id: '2', name: 'Pet Supplies', slug: 'pet-supplies' }, isTrending: true,
  },
  {
    id: '3', name: 'Minimalist Nordic Desk Organizer', slug: 'nordic-desk-organizer',
    description: 'Clean lines desk organizer', price: 28.99, minOrderQty: 2, sku: 'HOME-003',
    inventory: 80, images: ['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400'],
    category: { id: '4', name: 'Home Décor', slug: 'home-decor' },
  },
  {
    id: '4', name: 'Creative LED Message Board', slug: 'led-message-board',
    description: 'USB powered LED board', price: 19.99, minOrderQty: 3, sku: 'GIFT-004',
    inventory: 120, images: ['https://images.unsplash.com/photo-1549490349-8643362247b5?w=400'],
    category: { id: '3', name: 'Creative Gifts', slug: 'gifts' }, isTrending: true,
  },
  {
    id: '5', name: 'Ins-Style Ceramic Vase Set', slug: 'ins-ceramic-vase-set',
    description: 'Trendy ceramic vase set', price: 34.99, minOrderQty: 2, sku: 'HOME-005',
    inventory: 60, images: ['https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=400'],
    category: { id: '4', name: 'Home Décor', slug: 'home-decor' },
  },
  {
    id: '6', name: 'Pet Carrier Backpack', slug: 'pet-carrier-backpack',
    description: 'Hands-free pet carrier', price: 45.99, minOrderQty: 2, sku: 'PET-006',
    inventory: 45, images: ['https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400'],
    category: { id: '2', name: 'Pet Supplies', slug: 'pet-supplies' },
  },
  {
    id: '7', name: 'Layered Gold-Plated Charm Bracelet', slug: 'gold-layered-charm-bracelet',
    description: 'Elegant layered bracelet', price: 8.99, minOrderQty: 5, sku: 'AC-007',
    inventory: 300, images: ['https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400'],
    category: { id: '1', name: 'Accessories', slug: 'accessories' }, isTrending: true,
  },
  {
    id: '8', name: 'Wireless Pet Water Fountain', slug: 'wireless-pet-fountain',
    description: 'Silent water fountain', price: 32.99, minOrderQty: 3, sku: 'PET-008',
    inventory: 90, images: ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400'],
    category: { id: '2', name: 'Pet Supplies', slug: 'pet-supplies' },
  },
]

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'trending', label: 'Trending' },
]

function ProductsContent() {
  const searchParams = useSearchParams()
  const { currency } = useCartStore()
  const [products] = useState(MOCK_PRODUCTS)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('featured')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const activeCategory = searchParams.get('category') || selectedCategory

  const filteredProducts = products.filter(p => {
    if (activeCategory && p.category.slug !== activeCategory) return false
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <>
      {/* Page Header */}
      <div className="bg-joy-gray-50 border-b border-joy-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="font-display text-3xl font-bold text-joy-gray-900 mb-2">
            {activeCategory 
              ? CATEGORIES.find(c => c.slug === activeCategory)?.name || 'Products'
              : 'All Products'
            }
          </h1>
          <p className="text-joy-gray-600">
            {filteredProducts.length} products available
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className={cn(
            'lg:w-64 flex-shrink-0',
            isFilterOpen ? 'block' : 'hidden lg:block'
          )}>
            <div className="bg-white rounded-xl border border-joy-gray-100 p-4 mb-6">
              <h3 className="font-semibold text-joy-gray-900 mb-4">Categories</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    !activeCategory ? 'bg-joy-orange text-white' : 'hover:bg-joy-gray-50'
                  )}
                >
                  All Products
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors',
                      activeCategory === cat.slug ? 'bg-joy-orange text-white' : 'hover:bg-joy-gray-50'
                    )}
                  >
                    <span>{cat.name}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      activeCategory === cat.slug ? 'bg-white/20' : 'bg-joy-gray-100'
                    )}>
                      {cat.productCount}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="relative w-full sm:w-auto">
                <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-joy-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none focus:ring-2 focus:ring-joy-orange/20 text-sm"
                />
              </div>

              <div className="flex items-center gap-4">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border-2 border-joy-gray-200 text-sm focus:border-joy-orange focus:outline-none"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <div className="hidden sm:flex items-center gap-1 bg-joy-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-2 rounded-md transition-colors',
                      viewMode === 'grid' ? 'bg-white shadow text-joy-orange' : 'text-joy-gray-500'
                    )}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'p-2 rounded-md transition-colors',
                      viewMode === 'list' ? 'bg-white shadow text-joy-orange' : 'text-joy-gray-500'
                    )}
                  >
                    <Icons.Menu size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-joy-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Icons.Search size={32} className="text-joy-gray-300" />
                </div>
                <h3 className="font-semibold text-joy-gray-900 mb-2">No products found</h3>
                <p className="text-joy-gray-500 mb-4">Try adjusting your search or filters</p>
                <Button variant="secondary" onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className={cn(
                'grid gap-4 lg:gap-6',
                viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'
              )}>
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} currency={currency} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <CartDrawer />
      <FloatingButtons />

      <main className="pt-[calc(4rem+36px)]">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-joy-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-joy-gray-600">Loading products...</p>
            </div>
          </div>
        }>
          <ProductsContent />
        </Suspense>
      </main>

      <Footer />
    </div>
  )
}

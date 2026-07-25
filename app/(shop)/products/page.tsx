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
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('featured')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const activeCategory = searchParams.get('category') || selectedCategory

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      if (data.success) {
        setProducts(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      if (data.success) {
        setCategories(data.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          productCount: 0,
        })))
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  const filteredProducts = products.filter(p => {
    if (activeCategory && p.category?.slug !== activeCategory) return false
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return 0 // Sorting by date not available without createdAt
      case 'price-low':
        return a.price - b.price
      case 'price-high':
        return b.price - a.price
      case 'trending':
        return (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0)
      case 'featured':
      default:
        return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)
    }
  })

  const currentCategoryName = activeCategory 
    ? categories.find(c => c.slug === activeCategory)?.name || 'Products'
    : 'All Products'

  return (
    <>
      {/* Page Header */}
      <div className="bg-joy-gray-50 border-b border-joy-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="font-display text-3xl font-bold text-joy-gray-900 mb-2">
            {currentCategoryName}
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
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors',
                      activeCategory === cat.slug ? 'bg-joy-orange text-white' : 'hover:bg-joy-gray-50'
                    )}
                  >
                    <span>{cat.name}</span>
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
                <div className="hidden sm:flex items-center gap-1 border-2 border-joy-gray-200 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn('p-2 rounded', viewMode === 'grid' ? 'bg-joy-orange text-white' : 'text-joy-gray-400')}
                  >
                    <Icons.Package size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn('p-2 rounded', viewMode === 'list' ? 'bg-joy-orange text-white' : 'text-joy-gray-400')}
                  >
                    <Icons.Menu size={18} />
                  </button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                >
                  Filters
                </Button>
              </div>
            </div>

            {/* Products Grid */}
            {isLoading ? (
              <div className={cn('grid gap-4 lg:gap-6', viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1')}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-16">
                <Icons.Search size={64} className="mx-auto mb-4 text-joy-gray-200" />
                <h3 className="text-xl font-semibold text-joy-gray-900 mb-2">No products found</h3>
                <p className="text-joy-gray-500 mb-6">Try adjusting your search or filter</p>
                <Button variant="secondary" onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className={cn('grid gap-4 lg:gap-6', viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1')}>
                {sortedProducts.map((product) => (
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
      <main className="pt-[calc(4rem+36px)]">
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>}>
          <ProductsContent />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <FloatingButtons />
    </div>
  )
}

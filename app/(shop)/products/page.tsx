'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { ProductCard } from '@/components/shop/ProductCard'
import { BatchProductCard } from '@/components/shop/BatchProductCard'
import { BatchOrderBar } from '@/components/shop/BatchOrderBar'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { cn, formatCurrency } from '@/lib/utils'
import { useCartStore } from '@/lib/store'
import type { Product } from '@/types'

interface Category {
  id: string
  name: string
  slug: string
  parentId: string | null
  children?: Category[]
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'trending', label: 'Trending' },
]

function buildCategoryTree(categories: Category[]): Category[] {
  const map: Record<string, Category> = {}
  const roots: Category[] = []
  
  // Initialize all categories
  categories.forEach(cat => {
    map[cat.id] = { ...cat, children: [] }
  })
  
  // Build tree
  categories.forEach(cat => {
    if (cat.parentId && map[cat.parentId]) {
      map[cat.parentId].children!.push(map[cat.id])
    } else {
      roots.push(map[cat.id])
    }
  })
  
  return roots
}

function CategorySidebar({ 
  categories, 
  selectedCategory, 
  onSelectCategory,
  expandedCats,
  onToggleExpand,
}: {
  categories: Category[]
  selectedCategory: string | null
  onSelectCategory: (slug: string | null) => void
  expandedCats: Set<string>
  onToggleExpand: (id: string) => void
}) {
  const roots = buildCategoryTree(categories)
  
  return (
    <div className="bg-white rounded-xl border border-joy-gray-100 p-4">
      <h3 className="font-semibold text-joy-gray-900 mb-4">Categories</h3>
      <div className="space-y-1">
        {/* All Products */}
        <button
          onClick={() => onSelectCategory(null)}
          className={cn(
            'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            !selectedCategory 
              ? 'bg-joy-orange text-white' 
              : 'hover:bg-joy-gray-50 text-joy-gray-700'
          )}
        >
          <span className="w-5 text-center">≡</span>
          All Products
        </button>
        
        {/* Category Tree */}
        {roots.map(cat => (
          <CategoryItem 
            key={cat.id} 
            category={cat} 
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            expandedCats={expandedCats}
            onToggleExpand={onToggleExpand}
            level={0}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryItem({
  category,
  selectedCategory,
  onSelectCategory,
  expandedCats,
  onToggleExpand,
  level,
}: {
  category: Category
  selectedCategory: string | null
  onSelectCategory: (slug: string | null) => void
  expandedCats: Set<string>
  onToggleExpand: (id: string) => void
  level: number
}) {
  const hasChildren = category.children && category.children.length > 0
  const isExpanded = expandedCats.has(category.id)
  const isSelected = selectedCategory === category.slug
  
  return (
    <div>
      <div 
        className={cn(
          'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2',
          isSelected 
            ? 'bg-joy-orange text-white' 
            : 'hover:bg-joy-gray-50 text-joy-gray-700',
          level > 0 && 'ml-4 border-l-2 border-joy-gray-100'
        )}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(category.id)
            }}
            className="p-0.5 hover:bg-black/10 rounded"
          >
            <Icons.ChevronRight 
              size={16} 
              className={cn('transition-transform', isExpanded && 'rotate-90')} 
            />
          </button>
        )}
        {!hasChildren && <span className="w-5" />}
        <button 
          onClick={() => onSelectCategory(category.slug)}
          className="flex-1 font-medium"
        >
          {category.name}
        </button>
        {hasChildren && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            isSelected ? 'bg-white/20' : 'bg-joy-gray-100'
          )}>
            {category.children!.length}
          </span>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {category.children!.map(child => (
            <CategoryItem 
              key={child.id} 
              category={child} 
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              expandedCats={expandedCats}
              onToggleExpand={onToggleExpand}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

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
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map())

  const activeCategory = searchParams.get('category') || selectedCategory

  // Batch selection handlers
  const toggleProductSelect = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Map(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        const product = products.find(p => p.id === productId)
        next.set(productId, product?.minOrderQty || 1)
      }
      return next
    })
  }

  const updateProductQuantity = (productId: string, qty: number) => {
    setSelectedProducts(prev => {
      const next = new Map(prev)
      if (next.has(productId)) {
        next.set(productId, qty)
      }
      return next
    })
  }

  const clearBatchSelection = () => {
    setSelectedProducts(new Map())
  }

  // Convert selected products to array for batch order bar
  const batchOrderItems = Array.from(selectedProducts.entries()).map(([productId, qty]) => {
    const product = products.find(p => p.id === productId)
    if (!product) return null
    const images: string[] = (() => {
      if (!product.images) return []
      if (Array.isArray(product.images)) return product.images
      try { return JSON.parse(product.images as string) } catch { return [product.images] }
    })()
    return {
      productId,
      name: product.name,
      sku: product.sku || '',
      price: product.price,
      quantity: qty,
      weight: product.weight || 0.5,
      image: images[0],
    }
  }).filter(Boolean) as any[]

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
      const res = await fetch('/api/categories')
      const data = await res.json()
      if (data.success) {
        setCategories(data.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          parentId: c.parentId || null,
        })))
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  const toggleExpand = (catId: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(catId)) {
        next.delete(catId)
      } else {
        next.add(catId)
      }
      return next
    })
  }

  // Get all category slugs under the selected category (including children)
  const getCategorySlugs = (slug: string | null): string[] => {
    if (!slug) return []
    
    const cat = categories.find(c => c.slug === slug)
    if (!cat) return [slug]
    
    const slugs = [slug]
    const addChildren = (parentId: string) => {
      categories
        .filter(c => c.parentId === parentId)
        .forEach(child => {
          slugs.push(child.slug)
          addChildren(child.id)
        })
    }
    addChildren(cat.id)
    return slugs
  }

  const activeCategorySlugs = getCategorySlugs(activeCategory)

  const filteredProducts = products.filter(p => {
    if (activeCategory && p.category?.slug && !activeCategorySlugs.includes(p.category.slug)) {
      return false
    }
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    return true
  })

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
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

  const getCategoryName = () => {
    if (!activeCategory) return 'All Products'
    const cat = categories.find(c => c.slug === activeCategory)
    return cat?.name || 'Products'
  }

  return (
    <>
      <link rel="canonical" href="https://huayu-ebon.vercel.app/products" />

      {/* Page Header */}
      <div className="bg-joy-gray-50 border-b border-joy-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <nav className="flex items-center gap-2 text-sm text-joy-gray-500 mb-4">
            <a href="/" className="hover:text-joy-orange">Home</a>
            <Icons.ChevronRight size={14} />
            <span className="text-joy-gray-700 font-medium">Products</span>
          </nav>
          <h1 className="font-display text-3xl font-bold text-joy-gray-900 mb-2">
            {getCategoryName()}
          </h1>
          <p className="text-joy-gray-600">
            {filteredProducts.length} products available
          </p>
        </div>
      </div>

      {/* JSON-LD CollectionPage Schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Huayu Wholesale Products',
          description: 'Wholesale products including accessories, pet supplies, home decor and gifts.',
          url: 'https://huayu-ebon.vercel.app/products',
        })
      }} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className={cn(
            'lg:w-72 flex-shrink-0',
            isFilterOpen ? 'block' : 'hidden lg:block'
          )}>
            <CategorySidebar 
              categories={categories}
              selectedCategory={activeCategory}
              onSelectCategory={setSelectedCategory}
              expandedCats={expandedCats}
              onToggleExpand={toggleExpand}
            />
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
                  className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none text-sm"
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
                
                {/* Batch Mode Toggle */}
                <button
                  onClick={() => {
                    setBatchMode(!batchMode)
                    if (batchMode) clearBatchSelection()
                  }}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-2',
                    batchMode 
                      ? 'bg-joy-orange border-joy-orange text-white' 
                      : 'border-joy-gray-200 text-joy-gray-600 hover:border-joy-orange'
                  )}
                >
                  <Icons.Check size={18} />
                  Batch Order
                </button>
                
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
              <div className={cn('grid gap-3 lg:gap-4', viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1')}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl h-60 animate-pulse" />
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
              <>
                {batchMode ? (
                  // Batch Mode Grid
                  <div className="grid gap-3 lg:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {sortedProducts.map((product) => (
                      <BatchProductCard
                        key={product.id}
                        product={product}
                        currency={currency}
                        selected={selectedProducts.has(product.id)}
                        quantity={selectedProducts.get(product.id) || product.minOrderQty || 1}
                        onToggleSelect={toggleProductSelect}
                        onQuantityChange={updateProductQuantity}
                      />
                    ))}
                  </div>
                ) : (
                  // Normal Mode Grid
                  <div className={cn('grid gap-3 lg:gap-4', viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1')}>
                    {sortedProducts.map((product) => (
                      <ProductCard key={product.id} product={product} currency={currency} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Batch Order Bar */}
        {batchMode && (
          <BatchOrderBar
            items={batchOrderItems}
            currency={currency}
            onClear={clearBatchSelection}
            onContinueShopping={() => setBatchMode(false)}
          />
        )}
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

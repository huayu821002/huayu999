'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProductCard } from '@/components/shop/ProductCard'
import { BatchProductCard } from '@/components/shop/BatchProductCard'
import { BatchOrderBar } from '@/components/shop/BatchOrderBar'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/lib/store'
import type { Product } from '@/types'

interface Category {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  bannerImage?: string | null
  parent?: { name: string; slug: string } | null
  children?: { id: string; name: string; slug: string }[]
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'name-az', label: 'Name A-Z' },
]

export function CategoryClient({ category, initialProducts, currentSort, currentPage }: {
  category: Category
  initialProducts: Product[]
  currentSort: string
  currentPage: number
}) {
  const router = useRouter()
  const [products] = useState(initialProducts)
  const [sort, setSort] = useState(currentSort)
  const { items, currency } = useCartStore()
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0)

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map())

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

  const handleSortChange = (newSort: string) => {
    setSort(newSort)
    router.push(`/categories/${category.slug}?sort=${newSort}&page=1`)
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <div className="pt-28 pb-16">

        {/* Category Hero Banner */}
        {(category.bannerImage || category.image) && (
          <div className="relative h-48 md:h-64 lg:h-72 overflow-hidden mb-8">
            <img
              src={category.bannerImage || category.image || ''}
              alt={category.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-4 pb-6">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-white/80 mb-3">
                <Link href="/" className="hover:text-white">Home</Link>
                <Icons.ChevronRight size={12} />
                {category.parent && (
                  <>
                    <Link href={`/categories/${category.parent.slug}`} className="hover:text-white">{category.parent.name}</Link>
                    <Icons.ChevronRight size={12} />
                  </>
                )}
                <span className="text-white font-medium">{category.name}</span>
              </nav>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white">{category.name}</h1>
              {category.description && (
                <p className="text-white/80 mt-2 max-w-2xl">{category.description}</p>
              )}
            </div>
          </div>
        )}

        {!category.image && (
          <div className="max-w-7xl mx-auto px-4 mb-6">
            <nav className="flex items-center gap-2 text-sm text-joy-gray-500 mb-4">
              <Link href="/" className="hover:text-joy-orange">Home</Link>
              <Icons.ChevronRight size={12} />
              {category.parent && (
                <>
                  <Link href={`/categories/${category.parent.slug}`} className="hover:text-joy-orange">{category.parent.name}</Link>
                  <Icons.ChevronRight size={12} />
                </>
              )}
              <span className="text-joy-gray-800 font-medium">{category.name}</span>
            </nav>
            <h1 className="text-3xl font-display font-bold text-joy-gray-900">{category.name}</h1>
            {category.description && (
              <p className="text-joy-gray-500 mt-2">{category.description}</p>
            )}
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4">
          {/* Sub-categories */}
          {category.children && category.children.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {category.children.map(child => (
                  <Link
                    key={child.id}
                    href={`/categories/${child.slug}`}
                    className="flex-shrink-0 px-5 py-2.5 bg-white rounded-full border border-joy-gray-200 text-sm font-medium text-joy-gray-700 hover:border-joy-orange hover:text-joy-orange transition-colors shadow-sm"
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-6 bg-white rounded-2xl shadow-sm px-5 py-4">
            <p className="text-sm text-joy-gray-500">
              {products.length > 0 ? (
                <>Showing <span className="font-semibold text-joy-gray-800">{products.length}</span> products</>
              ) : (
                'No products in this category yet'
              )}
            </p>
            <div className="flex items-center gap-3">
              {/* Batch Mode Toggle */}
              {products.length > 0 && (
                <button
                  onClick={() => {
                    setBatchMode(!batchMode)
                    if (batchMode) clearBatchSelection()
                  }}
                  className={cn(
                    'px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-2',
                    batchMode 
                      ? 'bg-joy-orange border-joy-orange text-white' 
                      : 'border-joy-gray-200 text-joy-gray-600 hover:border-joy-orange'
                  )}
                >
                  <Icons.Check size={16} />
                  Batch Order
                </button>
              )}
              <label className="text-sm text-joy-gray-500">Sort:</label>
              <select
                value={sort}
                onChange={e => handleSortChange(e.target.value)}
                className="px-3 py-1.5 border border-joy-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Products Grid */}
          {products.length > 0 ? (
            batchMode ? (
              // Batch Mode Grid
              <div className="grid gap-3 lg:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} currency={currency} />
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl">
              <div className="w-16 h-16 mx-auto rounded-full bg-joy-gray-100 flex items-center justify-center mb-4">
                <Icons.Search size={24} className="text-joy-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-joy-gray-700 mb-2">No products yet</h3>
              <p className="text-sm text-joy-gray-500 mb-6">Products in this category will appear here.</p>
              <Button onClick={() => router.push('/products')}>Browse All Products</Button>
            </div>
          )}
        </div>
      </div>
      <Footer />

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
  )
}

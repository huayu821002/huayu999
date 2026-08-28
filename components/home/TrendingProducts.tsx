'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ProductCard } from '@/components/shop/ProductCard'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import type { Product } from '@/types'

export function TrendingProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/site/trending')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.length > 0) {
          setProducts(data.data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-joy-pink text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                  🔥 HOT
                </span>
                <h2 className="font-display text-2xl font-bold text-joy-gray-900">
                  Trending Now
                </h2>
              </div>
              <p className="text-joy-gray-500 mt-1">Based on recent orders</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-joy-gray-200 rounded-2xl mb-4" />
                <div className="h-4 bg-joy-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-joy-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (products.length === 0) return null

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-joy-pink text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                🔥 HOT
              </span>
              <h2 className="font-display text-2xl font-bold text-joy-gray-900">
                Trending Now
              </h2>
            </div>
            <p className="text-joy-gray-500 mt-1">
              Based on recent orders
            </p>
          </div>
          <Link href="/products?collection=trending">
            <Button variant="secondary">
              View All <Icons.ChevronRight size={18} className="ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {products.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}

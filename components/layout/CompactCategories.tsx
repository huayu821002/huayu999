'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

interface Category {
  id: string
  name: string
  slug: string
  image?: string
  children?: { id: string; name: string; slug: string }[]
}

interface CompactCategoriesProps {
  isOpen: boolean
  onClose: () => void
}

export function CompactCategories({ isOpen, onClose }: CompactCategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/site/categories-full')
        const data = await res.json()
        if (data.success && data.data) {
          setCategories(data.data)
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      } finally {
        setIsLoading(false)
      }
    }
    if (isOpen) fetchCategories()
  }, [isOpen])

  // Lock body scroll on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Desktop: Lightweight dropdown below nav */}
      <div
        className="hidden lg:block absolute top-full left-0 right-0 z-50"
        ref={menuRef}
      >
        {/* Subtle backdrop */}
        <div className="absolute inset-0 bg-black/10 -z-10" onClick={onClose} />

        <div className="bg-white border-b border-joy-gray-200 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-start gap-8">
              {/* All categories as list */}
              <div className="flex-1">
                <p className="text-xs font-bold text-joy-gray-400 uppercase tracking-wider mb-3">All Collections</p>
                <div className="grid grid-cols-4 gap-x-8 gap-y-2">
                  {isLoading ? (
                    [...Array(8)].map((_, i) => (
                      <div key={i} className="animate-pulse h-6 bg-joy-gray-100 rounded" />
                    ))
                  ) : (
                    categories.map((cat) => (
                      <div key={cat.id}>
                        {/* Parent category */}
                        <Link
                          href={`/products?category=${cat.slug}`}
                          onClick={onClose}
                          className="block py-1.5 text-sm font-semibold text-joy-gray-800 hover:text-joy-orange transition-colors"
                        >
                          {cat.name}
                        </Link>
                        {/* Sub-categories */}
                        {cat.children && cat.children.length > 0 && (
                          <div className="ml-2 pl-2 border-l border-joy-gray-100 space-y-1">
                            {cat.children.slice(0, 5).map((sub) => (
                              <Link
                                key={sub.id}
                                href={`/products?category=${sub.slug}`}
                                onClick={onClose}
                                className="block py-1 text-xs text-joy-gray-500 hover:text-joy-orange transition-colors"
                              >
                                {sub.name}
                              </Link>
                            ))}
                            {cat.children.length > 5 && (
                              <span className="text-xs text-joy-gray-400">+{cat.children.length - 5} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right promo card */}
              <div className="w-56 flex-shrink-0">
                <p className="text-xs font-bold text-joy-gray-400 uppercase tracking-wider mb-3">Featured</p>
                <Link
                  href="/products"
                  onClick={onClose}
                  className="block rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                >
                  <div className="relative h-36">
                    <img
                      src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400"
                      alt="Shop all"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-white font-bold text-sm">Shop All Products</p>
                      <p className="text-white/70 text-xs mt-0.5">Explore our full catalog</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-joy-gray-100 flex items-center justify-between">
              <p className="text-xs text-joy-gray-400">{categories.length} collections available</p>
              <Link
                href="/products"
                onClick={onClose}
                className="text-xs font-semibold text-joy-orange hover:text-joy-orange/80 transition-colors flex items-center gap-1"
              >
                View all products
                <Icons.ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Bottom sheet */}
      <div className="lg:hidden">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
          onClick={onClose}
        />
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div className="w-12 h-1.5 bg-joy-gray-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 pb-3 border-b border-joy-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-joy-gray-900">Browse by Collection</h2>
                <p className="text-joy-gray-500 text-sm">Select a category</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-joy-gray-100 rounded-full transition-colors"
              >
                <Icons.X size={20} />
              </button>
            </div>
          </div>

          {/* Category list */}
          <div className="flex-1 overflow-y-auto py-3">
            {isLoading ? (
              <div className="px-5 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse h-14 bg-joy-gray-100 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="px-5 space-y-1">
                {categories.map((cat) => (
                  <div key={cat.id}>
                    {/* Parent */}
                    <Link
                      href={`/products?category=${cat.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-joy-gray-50 transition-colors"
                    >
                      {cat.image && (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <span className="flex-1 font-semibold text-joy-gray-800">{cat.name}</span>
                      <Icons.ChevronRight size={16} className="text-joy-gray-400" />
                    </Link>

                    {/* Sub-categories */}
                    {cat.children && cat.children.length > 0 && (
                      <div className="pl-14 pr-3 space-y-1 pb-2">
                        {cat.children.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/products?category=${sub.slug}`}
                            onClick={onClose}
                            className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm text-joy-gray-600 hover:bg-joy-orange/5 hover:text-joy-orange transition-colors"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-joy-gray-300" />
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-joy-gray-100 bg-joy-gray-50">
            <Link
              href="/products"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-joy-orange text-white rounded-xl font-semibold"
            >
              View All Products
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

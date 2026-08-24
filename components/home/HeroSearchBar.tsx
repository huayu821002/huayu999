'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'

interface SuggestionProduct {
  id: string
  name: string
  price: number
  compareAtPrice?: number | null
  images: string | string[]
  slug: string
  category?: { name: string; slug: string } | null
}

interface SuggestionCategory {
  id: string
  name: string
  slug: string
  image?: string | null
}

interface SearchSuggestions {
  products: SuggestionProduct[]
  categories: SuggestionCategory[]
  hotKeywords: string[]
}

export function HeroSearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestions | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 渐入动画
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 防抖搜索
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions(null)
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/site/search/suggestions?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.success) setSuggestions(data.data)
    } catch {
      setSuggestions(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setShowDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setShowDropdown(false)
    if (query.trim()) {
      router.push(`/products?search=${encodeURIComponent(query.trim())}`)
    }
  }

  const handleKeywordClick = (keyword: string) => {
    setShowDropdown(false)
    router.push(`/products?search=${encodeURIComponent(keyword)}`)
  }

  const getImage = (images: string | string[] | undefined) => {
    if (!images) return '/placeholder.png'
    if (Array.isArray(images)) {
      try {
        const parsed = JSON.parse(images[0])
        return parsed.url || images[0]
      } catch {
        return images[0]
      }
    }
    return images
  }

  const hasResults = suggestions && (
    (suggestions.products && suggestions.products.length > 0) ||
    (suggestions.categories && suggestions.categories.length > 0)
  )

  return (
    <div
      ref={wrapperRef}
      className={`w-full max-w-3xl mx-auto px-4 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative flex items-center">
        <div className="relative flex-1 flex items-center bg-white rounded-2xl shadow-lg border-2 border-joy-orange/20 focus-within:border-joy-orange transition-colors overflow-hidden">
          <Icons.Search size={20} className="absolute left-4 text-joy-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            placeholder="Search products, categories, brands..."
            className="w-full pl-12 pr-4 py-4 text-base bg-transparent outline-none placeholder-joy-gray-400"
            autoComplete="off"
          />
          {isLoading && (
            <div className="absolute right-4 flex items-center gap-1">
              <div className="w-4 h-4 border-2 border-joy-orange/30 border-t-joy-orange rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="submit"
          className="ml-3 px-6 py-4 bg-joy-orange hover:bg-joy-orange/90 text-white font-semibold rounded-2xl shadow-lg transition-all active:scale-95"
        >
          Search
        </button>
      </form>

      {/* Suggestions Dropdown */}
      {showDropdown && suggestions && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-joy-gray-100 overflow-hidden z-50 max-h-[500px] overflow-y-auto">
          {/* Hot Keywords */}
          {!hasResults && suggestions.hotKeywords && suggestions.hotKeywords.length > 0 && (
            <div className="p-4 border-b border-joy-gray-100">
              <p className="text-xs font-semibold text-joy-gray-400 uppercase tracking-wider mb-3">Trending</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.hotKeywords.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => handleKeywordClick(kw)}
                    className="px-3 py-1.5 bg-joy-gray-50 hover:bg-joy-orange/10 text-joy-gray-600 hover:text-joy-orange text-sm rounded-full border border-joy-gray-200 transition-colors"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {suggestions.categories && suggestions.categories.length > 0 && (
            <div className="p-4 border-b border-joy-gray-100">
              <p className="text-xs font-semibold text-joy-gray-400 uppercase tracking-wider mb-3">Categories</p>
              <div className="grid grid-cols-2 gap-2">
                {suggestions.categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-joy-gray-50 transition-colors group"
                  >
                    {cat.image && (
                      <img src={cat.image} alt={cat.name} className="w-10 h-10 rounded-lg object-cover" />
                    )}
                    <span className="font-medium text-joy-gray-700 group-hover:text-joy-orange transition-colors">{cat.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {suggestions.products && suggestions.products.length > 0 && (
            <div className="p-4">
              <p className="text-xs font-semibold text-joy-gray-400 uppercase tracking-wider mb-3">Products</p>
              <div className="grid grid-cols-1 gap-2">
                {suggestions.products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-joy-gray-50 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-joy-gray-100 flex-shrink-0">
                      <img
                        src={getImage(product.images)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-joy-gray-800 group-hover:text-joy-orange transition-colors truncate">{product.name}</p>
                      <p className="text-sm text-joy-gray-400">${product.price?.toFixed(2)}</p>
                    </div>
                    {product.category && (
                      <span className="text-xs text-joy-gray-400 bg-joy-gray-50 px-2 py-0.5 rounded-full">{product.category.name}</span>
                    )}
                  </Link>
                ))}
              </div>
              <button
                onClick={() => { setShowDropdown(false); router.push(`/products?search=${encodeURIComponent(query)}`) }}
                className="w-full mt-3 py-2 text-sm text-joy-orange hover:text-joy-orange/80 font-medium text-center border-t border-joy-gray-100 pt-3"
              >
                See all results for &quot;{query}&quot; →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

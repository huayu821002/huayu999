'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'
import { parseProductImages } from '@/lib/imageUtils'

export function StickySearchBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const heroHeight = 600 // approximate hero height for scroll trigger

  // 只在首页显示
  if (pathname !== '/') return null

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > heroHeight)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions(null); return }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/site/search/suggestions?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.success) setSuggestions(data.data)
    } catch { setSuggestions(null) }
    finally { setIsLoading(false) }
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
    if (query.trim()) router.push(`/products?search=${encodeURIComponent(query.trim())}`)
  }

  const hasResults = suggestions && (
    (suggestions.products?.length > 0) || (suggestions.categories?.length > 0)
  )

  return (
    <div
      ref={wrapperRef}
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop blur bar */}
      <div className="bg-white/95 backdrop-blur-md border-b border-joy-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <div className="relative flex-1 flex items-center bg-joy-gray-50 rounded-xl border border-joy-gray-200 focus-within:border-joy-orange transition-colors overflow-hidden">
              <Icons.Search size={16} className="absolute left-3 text-joy-gray-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => query.length >= 2 && setShowDropdown(true)}
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-transparent outline-none placeholder-joy-gray-400"
                autoComplete="off"
              />
              {isLoading && (
                <div className="absolute right-3">
                  <div className="w-3.5 h-3.5 border-2 border-joy-orange/30 border-t-joy-orange rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              type="submit"
              className="ml-2 px-4 py-2.5 bg-joy-orange hover:bg-joy-orange/90 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Search
            </button>
          </form>

          {/* Compact Dropdown */}
          {showDropdown && suggestions && hasResults && (
            <div className="mt-2 bg-white rounded-xl shadow-xl border border-joy-gray-100 overflow-hidden max-h-80 overflow-y-auto">
              {suggestions.categories?.length > 0 && (
                <div className="p-3 border-b border-joy-gray-100">
                  <p className="text-xs font-semibold text-joy-gray-400 mb-2">Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.categories.map((cat: any) => (
                      <button
                        key={cat.id}
                        onClick={() => { setShowDropdown(false); router.push(`/products?category=${cat.slug}`) }}
                        className="px-2.5 py-1 text-xs bg-joy-gray-50 hover:bg-joy-orange/10 text-joy-gray-600 hover:text-joy-orange rounded-lg border border-joy-gray-200 transition-colors"
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {suggestions.products?.length > 0 && (
                <div className="p-3">
                  <p className="text-xs font-semibold text-joy-gray-400 mb-2">Products</p>
                  <div className="space-y-1">
                    {suggestions.products.slice(0, 4).map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => { setShowDropdown(false); router.push(`/products/${p.slug}`) }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-joy-gray-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-joy-gray-100 overflow-hidden flex-shrink-0">
                          {p.images && <img src={parseProductImages(p.images)[0]} alt={p.name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-joy-gray-700 truncate">{p.name}</p>
                          <p className="text-xs text-joy-gray-400">${p.price?.toFixed(2)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

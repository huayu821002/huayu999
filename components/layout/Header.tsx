'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCartStore, useUIStore, useUserStore } from '@/lib/store'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { parseProductImages } from '@/lib/imageUtils'
import { Icons } from '@/components/ui/Icons'
import type { Currency } from '@/types'

const CURRENCIES: { code: Currency; symbol: string; name: string }[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
]

const defaultHeaderSettings = {
  promoBanner: {
    enabled: true,
    text: "🎉 $50 Minimum Mixed Order | Free Shipping NA $299+ | SA $499+ 🚚 15-20 Days Worldwide"
  },
  logo: { type: "text" as const, text: "Fiestaflare", image: "" },
  navLinks: [
    { href: "/", label: "Home" },
    { href: "/products", label: "Products" },
    { href: "/products?collection=trending-now", label: "🔥 Trending" },
    { href: "/products?collection=pet-me", label: "🐾 Pet & Me" },
    { href: "/info/about-us", label: "About" },
    { href: "/info/contact", label: "Contact" }
  ]
}

const HOT_KEYWORDS = ['trending', 'pet', 'accessories', 'gift', 'home decor', 'new arrival']

interface HeaderProps {
  initialSettings?: typeof defaultHeaderSettings
}

export function Header({ initialSettings }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const { items, setCurrency, currency } = useCartStore()
  const { isAuthenticated } = useUserStore()
  const { mobileMenuOpen, isMobileMenuOpen, mobileMenuClose } = useUIStore()
  const [headerSettings, setHeaderSettings] = useState(initialSettings || defaultHeaderSettings)
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(!!initialSettings)

  // Search overlay state
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0)

  useEffect(() => {
    if (initialSettings) {
      setIsSettingsLoaded(true)
      return
    }
    const fetchHeaderSettings = async () => {
      try {
        const res = await fetch('/api/site/header-footer')
        const data = await res.json()
        if (data.success && data.data.header) {
          setHeaderSettings(data.data.header)
        }
      } catch (err) {
        console.error('Failed to fetch header settings:', err)
      } finally {
        setIsSettingsLoaded(true)
      }
    }
    fetchHeaderSettings()
  }, [initialSettings])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  // Search overlay: focus input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setSuggestions(null)
      setShowDropdown(false)
    }
  }, [searchOpen])

  // Close search on route change
  useEffect(() => {
    setSearchOpen(false)
  }, [pathname])

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

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setShowDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowDropdown(false)
    if (query.trim()) router.push(`/products?search=${encodeURIComponent(query.trim())}`)
    setSearchOpen(false)
  }

  const handleKeywordClick = (kw: string) => {
    setShowDropdown(false)
    router.push(`/products?search=${encodeURIComponent(kw)}`)
    setSearchOpen(false)
  }

  const handleSuggestionProductClick = (slug: string) => {
    setShowDropdown(false)
    setSearchOpen(false)
    router.push(`/products/${slug}`)
  }

  const handleSuggestionCategoryClick = (slug: string) => {
    setShowDropdown(false)
    setSearchOpen(false)
    router.push(`/products?category=${slug}`)
  }

  const getImage = (images: any) => {
    const arr = parseProductImages(images)
    return arr[0] || '/placeholder.png'
  }

  const navLinks = headerSettings.navLinks || defaultHeaderSettings.navLinks
  const hasResults = suggestions && (
    (suggestions.products?.length > 0) || (suggestions.categories?.length > 0)
  )

  // ====== SEARCH OVERLAY ======
  if (searchOpen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-in slide-in-from-top-0 duration-300">
        {/* Search Header */}
        <div className="bg-white border-b border-joy-gray-100 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-2 hover:bg-joy-gray-100 rounded-xl transition-colors flex-shrink-0"
              >
                <Icons.ChevronLeft size={22} className="text-joy-gray-600" />
              </button>
              <div className="relative flex-1 flex items-center bg-joy-gray-50 rounded-2xl border-2 border-joy-orange/30 focus-within:border-joy-orange transition-colors overflow-hidden">
                <Icons.Search size={18} className="absolute left-4 text-joy-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={() => query.length >= 2 && setShowDropdown(true)}
                  placeholder="Search products, categories, brands..."
                  className="w-full pl-12 pr-4 py-3.5 text-base bg-transparent outline-none placeholder-joy-gray-400"
                  autoComplete="off"
                />
                {isLoading && (
                  <div className="absolute right-4">
                    <div className="w-5 h-5 border-2 border-joy-orange/30 border-t-joy-orange rounded-full animate-spin" />
                  </div>
                )}
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setSuggestions(null); setShowDropdown(false); searchInputRef.current?.focus() }}
                    className="absolute right-4 text-joy-gray-400 hover:text-joy-gray-600"
                  >
                    <Icons.X size={16} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 bg-joy-orange hover:bg-joy-orange/90 text-white font-semibold rounded-2xl transition-colors flex-shrink-0"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Search Suggestions */}
        <div className="flex-1 overflow-y-auto bg-joy-gray-50">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {!hasResults && !isLoading && (
              <>
                {/* Hot Keywords */}
                <div className="mb-6">
                  <p className="text-xs font-bold text-joy-gray-400 uppercase tracking-wider mb-3">🔥 Trending</p>
                  <div className="flex flex-wrap gap-2">
                    {HOT_KEYWORDS.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => handleKeywordClick(kw)}
                        className="px-4 py-2 bg-white hover:bg-joy-orange/10 text-joy-gray-600 hover:text-joy-orange text-sm rounded-full border border-joy-gray-200 hover:border-joy-orange transition-colors"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Links */}
                <div>
                  <p className="text-xs font-bold text-joy-gray-400 uppercase tracking-wider mb-3">Quick Links</p>
                  <div className="space-y-1">
                    {navLinks.slice(0, 5).map((link: any, idx: number) => (
                      <Link
                        key={idx}
                        href={link.href}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-joy-orange/5 rounded-xl border border-joy-gray-100 hover:border-joy-orange/30 transition-colors group"
                      >
                        <Icons.ChevronRight size={16} className="text-joy-gray-300 group-hover:text-joy-orange" />
                        <span className="font-medium text-joy-gray-700 group-hover:text-joy-orange">{link.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Category Results */}
            {suggestions?.categories?.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-joy-gray-400 uppercase tracking-wider mb-3">Categories</p>
                <div className="grid grid-cols-2 gap-3">
                  {suggestions.categories.map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={() => handleSuggestionCategoryClick(cat.slug)}
                      className="flex items-center gap-3 p-3 bg-white hover:bg-joy-orange/5 rounded-xl border border-joy-gray-100 hover:border-joy-orange/30 transition-all group"
                    >
                      {cat.image && (
                        <img src={cat.image} alt={cat.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      )}
                      <div className="text-left">
                        <p className="font-semibold text-joy-gray-800 group-hover:text-joy-orange transition-colors">{cat.name}</p>
                        <p className="text-xs text-joy-gray-400 mt-0.5">Browse category →</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Product Results */}
            {suggestions?.products?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-joy-gray-400 uppercase tracking-wider mb-3">Products</p>
                <div className="space-y-2">
                  {suggestions.products.map((product: any) => (
                    <button
                      key={product.id}
                      onClick={() => handleSuggestionProductClick(product.slug)}
                      className="w-full flex items-center gap-4 p-3 bg-white hover:bg-joy-orange/5 rounded-xl border border-joy-gray-100 hover:border-joy-orange/30 transition-all text-left group"
                    >
                      <div className="w-14 h-14 rounded-xl bg-joy-gray-100 overflow-hidden flex-shrink-0">
                        <img src={getImage(product.images)} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-joy-gray-800 group-hover:text-joy-orange transition-colors truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-joy-orange font-bold">${product.price?.toFixed(2)}</span>
                          {product.comparePrice && product.comparePrice > product.price && (
                            <span className="text-xs text-joy-gray-400 line-through">${product.comparePrice.toFixed(2)}</span>
                          )}
                          {product.category && (
                            <span className="text-xs text-joy-gray-400 bg-joy-gray-50 px-2 py-0.5 rounded-full">{product.category.name}</span>
                          )}
                        </div>
                      </div>
                      <Icons.ChevronRight size={16} className="text-joy-gray-300 group-hover:text-joy-orange flex-shrink-0" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setShowDropdown(false); router.push(`/products?search=${encodeURIComponent(query)}`); setSearchOpen(false) }}
                  className="w-full mt-4 py-3 text-center text-sm font-semibold text-joy-orange hover:text-joy-orange/80 border-t border-joy-gray-100 pt-4"
                >
                  See all results for &quot;{query}&quot; →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ====== NORMAL HEADER ======
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm'
          : 'bg-white'
      )}
    >
      {/* Promo Banner */}
      {headerSettings.promoBanner?.enabled && (
        <div
          className="bg-gradient-to-r from-joy-orange via-joy-pink to-joy-green text-white text-center py-2 text-sm font-medium"
          dangerouslySetInnerHTML={{ __html: headerSettings.promoBanner?.text || '' }}
        />
      )}

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            {(headerSettings.logo?.type as string) === 'image' && headerSettings.logo?.image ? (
              <img src={headerSettings.logo.image} alt={headerSettings.logo?.text || 'Logo'} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-joy-orange to-joy-pink flex items-center justify-center text-white font-display font-bold text-xl">
                {headerSettings.logo?.text?.charAt(0) || 'F'}
              </div>
            )}
            <div className="hidden sm:block">
              <div className="font-display font-bold text-xl text-joy-gray-900">{headerSettings.logo?.text || 'Fiestaflare'}</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link: any, idx: number) => (
              <div key={idx} className="relative">
                {link.children ? (
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === link.label ? null : link.label)}
                    className={cn(
                      'flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      pathname === link.href ? 'text-joy-orange' : 'text-joy-gray-700 hover:bg-joy-gray-100'
                    )}
                  >
                    {link.label}
                    <Icons.ChevronDown size={14} />
                  </button>
                ) : (
                  <Link
                    href={link.href}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      pathname === link.href ? 'text-joy-orange' : 'text-joy-gray-700 hover:bg-joy-gray-100'
                    )}
                  >
                    {link.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Language */}
            <LanguageSwitcher />

            {/* Currency */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="hidden md:block px-2 py-1.5 text-sm rounded-lg border border-joy-gray-200 bg-white focus:outline-none focus:border-joy-orange"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
              ))}
            </select>

            {/* Search — opens overlay */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 hover:bg-joy-gray-100 rounded-xl transition-colors"
              aria-label="Open search"
            >
              <Icons.Search size={20} className="text-joy-gray-600" />
            </button>

            {/* Wishlist */}
            <Link href="/wishlist" className="p-2 hover:bg-joy-gray-100 rounded-xl transition-colors relative">
              <Icons.Heart size={20} className="text-joy-gray-600" />
            </Link>

            {/* Cart */}
            <Link href="/cart" className="p-2 hover:bg-joy-gray-100 rounded-xl transition-colors relative">
              <Icons.ShoppingCart size={20} className="text-joy-gray-600" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-joy-orange text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* User */}
            {isAuthenticated ? (
              <Link href="/account" className="p-2 hover:bg-joy-gray-100 rounded-xl transition-colors">
                <Icons.User size={20} className="text-joy-gray-600" />
              </Link>
            ) : (
              <Link href="/login" className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-joy-gray-700 hover:text-joy-orange">
                <Icons.User size={18} />
                <span className="hidden lg:inline">Sign In</span>
              </Link>
            )}

            {/* Mobile Menu */}
            <button onClick={mobileMenuOpen} className="lg:hidden p-2 hover:bg-joy-gray-100 rounded-xl transition-colors">
              <Icons.Menu size={20} className="text-joy-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-joy-gray-100">
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {navLinks.map((link: any, idx: number) => (
              <Link
                key={idx}
                href={link.href}
                onClick={mobileMenuClose}
                className="block px-4 py-3 rounded-lg text-joy-gray-700 hover:bg-joy-gray-100 font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

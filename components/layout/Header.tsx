'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCartStore, useUIStore, useUserStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import type { Currency } from '@/types'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Products', children: [
    { href: '/products?category=accessories', label: 'Accessories' },
    { href: '/products?category=pet-supplies', label: 'Pet Supplies' },
    { href: '/products?category=gifts', label: 'Gift Ideas' },
    { href: '/products?category=home-decor', label: 'Home Décor' },
  ]},
  { href: '/products?collection=trending-now', label: '🔥 Trending' },
  { href: '/products?collection=pet-me', label: '🐾 Pet & Me' },
]

const CURRENCIES: { code: Currency; symbol: string; name: string }[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
]

export function Header() {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const { items, setCurrency, currency } = useCartStore()
  const { isAuthenticated, user } = useUserStore()
  const { mobileMenuOpen, isMobileMenuOpen, mobileMenuClose } = useUIStore()

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

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
      <div className="bg-gradient-to-r from-joy-orange via-joy-pink to-joy-green text-white text-center py-2 text-sm font-medium">
        <span className="hidden sm:inline">🎉</span> $50 Minimum Mixed Order | 
        <span className="font-bold mx-1">Free Shipping NA $299+</span> | 
        <span className="font-bold mx-1">SA $499+</span>
        <span className="hidden sm:inline"> 🚚 15-20 Days Worldwide</span>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-joy-orange to-joy-pink flex items-center justify-center text-white font-display font-bold text-xl">
              FF
            </div>
            <div className="hidden sm:block">
              <div className="font-display font-bold text-xl text-joy-gray-900">Fiestaflare</div>
              <div className="text-xs text-joy-gray-500 -mt-1">Wholesaler</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <div
                key={link.href}
                className="relative"
                onMouseEnter={() => link.children && setActiveDropdown(link.href)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <Link
                  href={link.href}
                  className={cn(
                    'nav-link py-2',
                    pathname === link.href && 'text-joy-orange'
                  )}
                >
                  {link.label}
                </Link>
                {link.children && activeDropdown === link.href && (
                  <div className="absolute top-full left-0 pt-2">
                    <div className="bg-white rounded-xl shadow-xl border border-joy-gray-100 py-2 min-w-[200px] animate-fade-in">
                      {link.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block px-4 py-2 text-joy-gray-700 hover:bg-joy-gray-50 hover:text-joy-orange transition-colors"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Safety & Compliance - Desktop */}
          <Link
            href="/compliance"
            className="hidden xl:flex items-center gap-2 px-4 py-2 bg-joy-green/10 text-joy-green rounded-lg hover:bg-joy-green/20 transition-colors"
          >
            <Icons.ShieldCheck size={18} />
            <span className="text-sm font-medium">Safety & Compliance</span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Currency Selector */}
            <div className="relative hidden md:block">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="appearance-none bg-joy-gray-50 border border-joy-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium cursor-pointer hover:border-joy-orange transition-colors focus:outline-none focus:ring-2 focus:ring-joy-orange/20"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code}
                  </option>
                ))}
              </select>
              <Icons.ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-joy-gray-400 pointer-events-none" />
            </div>

            {/* Search */}
            <button
              onClick={() => useUIStore.getState().toggleSearch()}
              className="p-2 rounded-lg hover:bg-joy-gray-100 transition-colors"
              aria-label="Search"
            >
              <Icons.Search size={20} />
            </button>

            {/* Account */}
            <Link
              href={isAuthenticated ? '/account' : '/login'}
              className="p-2 rounded-lg hover:bg-joy-gray-100 transition-colors"
              aria-label="Account"
            >
              <Icons.User size={20} />
            </Link>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="p-2 rounded-lg hover:bg-joy-gray-100 transition-colors relative"
              aria-label="Wishlist"
            >
              <Icons.Heart size={20} />
            </Link>

            {/* Cart */}
            <button
              onClick={() => useCartStore.getState().toggleCart()}
              className="p-2 rounded-lg hover:bg-joy-gray-100 transition-colors relative"
              aria-label="Cart"
            >
              <Icons.ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-joy-orange text-white text-xs font-bold flex items-center justify-center animate-bounce-in">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={isMobileMenuOpen ? mobileMenuClose : mobileMenuOpen}
              className="lg:hidden p-2 rounded-lg hover:bg-joy-gray-100 transition-colors"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <Icons.X size={24} /> : <Icons.Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-[calc(4rem+36px)] bg-white z-40 animate-slide-up">
          <nav className="max-w-7xl mx-auto px-4 py-6 space-y-2">
            {NAV_LINKS.map((link) => (
              <div key={link.href}>
                <Link
                  href={link.href}
                  onClick={mobileMenuClose}
                  className="block py-3 px-4 text-lg font-medium text-joy-gray-800 hover:bg-joy-gray-50 hover:text-joy-orange rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
                {link.children && (
                  <div className="pl-4 space-y-1">
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={mobileMenuClose}
                        className="block py-2 px-4 text-joy-gray-600 hover:bg-joy-gray-50 hover:text-joy-orange rounded-lg transition-colors"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            <div className="pt-4 border-t border-joy-gray-100">
              <Link
                href="/compliance"
                onClick={mobileMenuClose}
                className="flex items-center gap-2 py-3 px-4 text-joy-green font-medium"
              >
                <Icons.ShieldCheck size={20} />
                Safety & Compliance
              </Link>
              <Link
                href="/shipping"
                onClick={mobileMenuClose}
                className="flex items-center gap-2 py-3 px-4 text-joy-gray-700 font-medium"
              >
                <Icons.Truck size={20} />
                Shipping Info (15-20 Days)
              </Link>
            </div>

            {/* Mobile Currency Selector */}
            <div className="pt-4 border-t border-joy-gray-100">
              <div className="px-4 text-sm text-joy-gray-500 mb-2">Currency</div>
              <div className="flex gap-2 px-4">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      currency === c.code
                        ? 'bg-joy-orange text-white'
                        : 'bg-joy-gray-100 text-joy-gray-700 hover:bg-joy-gray-200'
                    )}
                  >
                    {c.symbol} {c.code}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* Logistics Progress Bar - Only on Home */}
      {pathname === '/' && (
        <div className="hidden lg:block bg-joy-gray-50 border-t border-joy-gray-100">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <Icons.Truck size={18} className="text-joy-orange" />
                <span className="text-joy-gray-700">North America: <span className="font-semibold text-joy-gray-900">7-10 Days</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Icons.Truck size={18} className="text-joy-pink" />
                <span className="text-joy-gray-700">South America: <span className="font-semibold text-joy-gray-900">15-20 Days</span></span>
              </div>
              <div className="logistics-bar w-32 h-2 bg-joy-gray-200 rounded-full overflow-hidden">
                <div className="logistics-fill w-3/4" />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

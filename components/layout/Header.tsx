'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCartStore, useUIStore, useUserStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
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

interface HeaderProps {
  initialSettings?: typeof defaultHeaderSettings
}

export function Header({ initialSettings }: HeaderProps) {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const { items, setCurrency, currency } = useCartStore()
  const { isAuthenticated, user } = useUserStore()
  const { mobileMenuOpen, isMobileMenuOpen, mobileMenuClose } = useUIStore()
  const [headerSettings, setHeaderSettings] = useState(initialSettings || defaultHeaderSettings)
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(!!initialSettings)

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

  const navLinks = headerSettings.navLinks || defaultHeaderSettings.navLinks

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
            {typeof headerSettings.logo?.type === 'string' && headerSettings.logo?.type === 'image' && headerSettings.logo?.image ? (
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
          <div className="flex items-center gap-2">
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

            {/* Search */}
            <Link href="/products" className="p-2 hover:bg-joy-gray-100 rounded-lg">
              <Icons.Search size={20} className="text-joy-gray-600" />
            </Link>

            {/* Wishlist */}
            <Link href="/wishlist" className="p-2 hover:bg-joy-gray-100 rounded-lg">
              <Icons.Heart size={20} className="text-joy-gray-600" />
            </Link>

            {/* Cart */}
            <Link href="/cart" className="p-2 hover:bg-joy-gray-100 rounded-lg relative">
              <Icons.ShoppingCart size={20} className="text-joy-gray-600" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-joy-orange text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* User */}
            {isAuthenticated ? (
              <Link href="/account" className="p-2 hover:bg-joy-gray-100 rounded-lg">
                <Icons.User size={20} className="text-joy-gray-600" />
              </Link>
            ) : (
              <Link href="/login" className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-joy-gray-700 hover:text-joy-orange">
                <Icons.User size={18} />
                Sign In
              </Link>
            )}

            {/* Mobile Menu */}
            <button onClick={mobileMenuOpen} className="lg:hidden p-2 hover:bg-joy-gray-100 rounded-lg">
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

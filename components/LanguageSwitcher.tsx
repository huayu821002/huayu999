'use client'

import { useState, useRef, useEffect } from 'react'
import { useCartStore } from '@/lib/store'
import { CURRENCY_SYMBOLS, COUNTRY_CURRENCY } from '@/types'

interface CountryOption {
  code: string
  name: string
  flag: string
  currency: string
}

const COUNTRIES: CountryOption[] = [
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', currency: 'AUD' },
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', currency: 'KRW' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', currency: 'IDR' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', currency: 'MYR' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'SGD' },
]

export function LanguageSwitcher() {
  const { currency, setCurrency } = useCartStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Find current country based on currency
  const current = COUNTRIES.find(c => c.currency === currency) || COUNTRIES[0]

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (country: CountryOption) => {
    setCurrency(country.currency as any)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-joy-gray-200 bg-white hover:border-joy-orange transition-colors"
      >
        <span>{current.flag}</span>
        <span className="hidden md:inline">{current.currency}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-joy-gray-200 shadow-lg z-50 overflow-hidden">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => handleSelect(c)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-joy-gray-50 transition-colors ${
                currency === c.currency ? 'bg-joy-orange/10 text-joy-orange font-medium' : 'text-joy-gray-700'
              }`}
            >
              <span>{c.flag}</span>
              <span className="flex-1 text-left">{c.name}</span>
              <span className="text-xs text-joy-gray-400">{CURRENCY_SYMBOLS[c.currency as keyof typeof CURRENCY_SYMBOLS]}{c.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

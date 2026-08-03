'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from '@/lib/translation/client'
import { SUPPORTED_LOCALES } from '@/lib/translation/translate'

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = SUPPORTED_LOCALES.find(l => l.code === locale) || SUPPORTED_LOCALES[0]

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-joy-gray-200 bg-white hover:border-joy-orange transition-colors"
      >
        <span>{current.flag}</span>
        <span className="hidden md:inline">{current.code.toUpperCase()}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg border border-joy-gray-200 shadow-lg z-50 overflow-hidden">
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLocale(l.code as 'en' | 'pt' | 'ru'); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-joy-gray-50 transition-colors ${
                locale === l.code ? 'bg-joy-orange/10 text-joy-orange font-medium' : 'text-joy-gray-700'
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

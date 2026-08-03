'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { SUPPORTED_LOCALES } from './translate'

type Locale = 'en' | 'pt' | 'ru'

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  translations: Record<string, any>
  loading: boolean
  isRTL: boolean
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'en',
  setLocale: () => {},
  translations: {},
  loading: false,
  isRTL: false,
})

const LOCALE_COOKIE = 'NEXT_LOCALE'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [translations, setTranslations] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Read locale from cookie (set by middleware)
    const cookies = document.cookie.split(';')
    const localeCookie = cookies.find(c => c.trim().startsWith(`${LOCALE_COOKIE}=`))
    const cookieLocale = localeCookie?.split('=')[1] as Locale
    
    if (cookieLocale && SUPPORTED_LOCALES.some(l => l.code === cookieLocale)) {
      setLocaleState(cookieLocale)
    }
  }, [])

  useEffect(() => {
    if (locale === 'en') {
      setTranslations({})
      return
    }
    
    const loadTranslations = async () => {
      setLoading(true)
      try {
        const [module] = await Promise.all([
          import(`@/locales/${locale}.json`),
        ])
        setTranslations(module.default || module)
      } catch (err) {
        console.error('Failed to load translations for locale:', locale, err)
      } finally {
        setLoading(false)
      }
    }
    loadTranslations()
  }, [locale])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
    // Reload to pick up new translations
    window.location.reload()
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, translations, loading, isRTL: false }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}

// Get translation key with fallback to English
export function useTranslation(key: string, fallback?: string): string {
  const { translations } = useLocale()
  
  const keys = key.split('.')
  let value: any = translations
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      return fallback ?? key
    }
  }
  
  return typeof value === 'string' ? value : (fallback ?? key)
}

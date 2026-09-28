'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { SUPPORTED_LOCALES } from './translate'

type Locale = 'en'

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

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [translations, setTranslations] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)

  // Only English is supported - no translations needed
  useEffect(() => {
    setLocaleState('en')
    setTranslations({})
  }, [])

  return (
    <LocaleContext.Provider value={{ locale, setLocale: () => {}, translations, loading: false, isRTL: false }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}

export function useTranslation(key: string, fallback?: string): string {
  return fallback ?? key
}

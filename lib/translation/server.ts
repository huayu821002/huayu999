// Server-side translation utilities
import { getLocaleFromHost } from './translate'

// Get locale from cookies (for Server Components)
export function getServerLocale(cookies: string): string {
  const localeMap: Record<string, string> = {
    pt: 'pt',
    ru: 'ru',
  }
  
  const match = cookies.match(/NEXT_LOCALE=(pt|ru)/)
  if (match) return match[1]
  
  return 'en'
}

// Read translations for a given locale (for Server Components)
export async function getTranslations(locale: string): Promise<Record<string, any>> {
  if (locale === 'en') return {}
  
  try {
    const translations = await import(`@/locales/${locale}.json`)
    return translations.default || translations
  } catch {
    return {}
  }
}

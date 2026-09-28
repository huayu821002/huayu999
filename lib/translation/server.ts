// Server-side translation utilities
import { getLocaleFromHost } from './translate'

// Get locale from cookies (for Server Components)
export function getServerLocale(cookies: string): string {
  return 'en'
}

// Read translations for a given locale (for Server Components)
export async function getTranslations(locale: string): Promise<Record<string, any>> {
  return {}
}

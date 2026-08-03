// Translation service with MyMemory (free) + Google Translate fallback
// Supports: en, pt, ru

const MYMEMORY_API = 'https://api.mymemory.translated.net/get'

interface TranslateResult {
  translated: string
  source: 'mymemory' | 'google'
}

// Translate text from English to target locale
export async function translate(
  text: string,
  targetLocale: 'pt' | 'ru',
  sourceLocale: string = 'en'
): Promise<TranslateResult | null> {
  if (!text || text.trim().length === 0) return null
  if (sourceLocale === targetLocale) return { translated: text, source: 'mymemory' }

  // Try MyMemory first (free, 1000 words/day)
  const result = await translateWithMyMemory(text, targetLocale, sourceLocale)
  if (result) return { translated: result, source: 'mymemory' }

  return null
}

// MyMemory API - free, no API key needed
async function translateWithMyMemory(
  text: string,
  targetLocale: 'pt' | 'ru',
  sourceLocale: string
): Promise<string | null> {
  try {
    const langPair = `${sourceLocale}|${targetLocale === 'pt' ? 'pt-br' : 'ru'}`
    const url = `${MYMEMORY_API}?q=${encodeURIComponent(text)}&langpair=${langPair}`

    const res = await fetch(url, { timeout: 5000 })
    if (!res.ok) return null

    const data = await res.json()
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText
    }
    return null
  } catch {
    return null
  }
}

// Batch translate multiple fields for a product
export async function translateProduct(
  product: {
    name?: string | null
    description?: string | null
    shortDesc?: string | null
  },
  targetLocale: 'pt' | 'ru'
): Promise<{
  name?: string | null
  description?: string | null
  shortDesc?: string | null
}> {
  const fields = ['name', 'description', 'shortDesc'] as const
  const result: Record<string, string | null> = {}

  // Translate fields in parallel, skip empty ones
  await Promise.all(
    fields.map(async (field) => {
      const value = product[field]
      if (!value) {
        result[field] = value
        return
      }
      const translated = await translate(value, targetLocale)
      result[field] = translated?.translated ?? value
    })
  )

  return result as { name?: string | null; description?: string | null; shortDesc?: string | null }
}

// Get locale from subdomain
export function getLocaleFromHost(host: string): string {
  if (!host) return 'en'
  const subdomain = host.split('.')[0] // br.fiestaflare.com -> br
  const localeMap: Record<string, string> = {
    br: 'pt',
    ru: 'ru',
  }
  return localeMap[subdomain] || 'en'
}

// Get display name for locale
export function getLocaleDisplayName(locale: string): string {
  const names: Record<string, string> = {
    en: 'English',
    pt: 'Português',
    ru: 'Русский',
  }
  return names[locale] || locale
}

// Get available locales
export const SUPPORTED_LOCALES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
] as const

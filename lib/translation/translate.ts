// Translation service with Baidu Translate API + MyMemory fallback
// Supports: en, pt, ru
// Baidu free tier: 2M chars/month for personal认证

const MYMEMORY_API = 'https://api.mymemory.translated.net/get'
const BAIDU_API = 'https://fanyi-api.baidu.com/api/trans/vip/translate'

interface TranslateResult {
  translated: string
  source: 'baidu' | 'mymemory'
}

// Baidu Translate credentials from .env
const BAIDU_APP_ID = process.env.BAIDU_TRANSLATE_APP_ID || ''
const BAIDU_SECRET_KEY = process.env.BAIDU_TRANSLATE_SECRET_KEY || ''

// MD5 hash
async function md5(text: string): Promise<string> {
  const crypto = await import('crypto')
  return crypto.createHash('md5').update(text).digest('hex')
}

// Main translation function
export async function translate(
  text: string,
  targetLocale: 'pt' | 'ru',
  sourceLocale: string = 'en'
): Promise<TranslateResult | null> {
  if (!text || text.trim().length === 0) return null
  if (sourceLocale === targetLocale) return { translated: text, source: 'baidu' }

  // Try Baidu first (2M chars/month free)
  const baiduResult = await translateWithBaidu(text, targetLocale, sourceLocale)
  if (baiduResult) return { translated: baiduResult, source: 'baidu' }

  // Fallback to MyMemory (1000 words/day)
  const mymemoryResult = await translateWithMyMemory(text, targetLocale, sourceLocale)
  if (mymemoryResult) return { translated: mymemoryResult, source: 'mymemory' }

  return null
}

// Baidu Translation API
async function translateWithBaidu(
  text: string,
  targetLocale: 'pt' | 'ru',
  sourceLocale: string
): Promise<string | null> {
  if (!BAIDU_APP_ID || !BAIDU_SECRET_KEY) return null

  try {
    const salt = Date.now().toString()
    const sign = await md5(BAIDU_APP_ID + text + salt + BAIDU_SECRET_KEY)
    const toLang = targetLocale === 'pt' ? 'pt' : 'ru'

    const url = `${BAIDU_API}?appid=${BAIDU_APP_ID}&q=${encodeURIComponent(text)}&from=${sourceLocale}&to=${toLang}&salt=${salt}&sign=${sign}`

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data = await res.json()
    if (data.error_code || !data.trans_result) {
      console.error('Baidu translate error:', data.error_msg)
      return null
    }

    return data.trans_result.map((t: any) => t.dst).join('')
  } catch (err) {
    console.error('Baidu translate failed:', err)
    return null
  }
}

// MyMemory API - free, no API key needed
async function translateWithMyMemory(
  text: string,
  targetLocale: 'pt' | 'ru',
  sourceLocale: string
): Promise<string | null> {
  const langPair = `${sourceLocale}|${targetLocale === 'pt' ? 'pt-br' : 'ru'}`

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = `${MYMEMORY_API}?q=${encodeURIComponent(text)}&langpair=${langPair}`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return null

      const data = await res.json()
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText
        if (translated === text || translated.includes('QUOTA EXCEEDED')) {
          return null
        }
        return translated
      }
      return null
    } catch {
      if (attempt === 1) return null
    }
  }
  return null
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

  await Promise.all(
    fields.map(async (field) => {
      const value = product[field]
      if (!value) return
      const translated = await translate(value, targetLocale)
      result[field] = (translated?.translated ?? value) as string | null
    })
  )

  return result as { name?: string | null; description?: string | null; shortDesc?: string | null }
}

// Get locale from subdomain
export function getLocaleFromHost(host: string): string {
  if (!host) return 'en'
  const subdomain = host.split('.')[0]
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

// Translation service with Baidu Translate API + MyMemory fallback
// Supports: en only (removed pt/ru 2026-09-28)
const MYMEMORY_API = 'https://api.mymemory.translated.net/get'
const BAIDU_API = 'https://fanyi-api.baidu.com/api/trans/v1/translat'

// Get locale from subdomain
export function getLocaleFromHost(host: string): string {
  if (!host) return 'en'
  return 'en'
}

// Get display name for locale
export function getLocaleDisplayName(locale: string): string {
  return 'English'
}

// Get available locales
export const SUPPORTED_LOCALES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
] as const

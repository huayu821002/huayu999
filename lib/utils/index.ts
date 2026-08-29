import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CURRENCY_RATES, CURRENCY_SYMBOLS, type Currency } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency]
  const rate = CURRENCY_RATES[currency]
  const converted = amount * rate
  
  return `${symbol}${converted.toFixed(2)}`
}

export function convertPrice(priceUSD: number, toCurrency: Currency): number {
  return priceUSD * CURRENCY_RATES[toCurrency]
}

export function getPriceByTier(
  price: number,
  quantity: number,
  currency: Currency = 'USD'
): { tier: string; price: number; total: number } {
  let tier: string
  let multiplier: number

  if (quantity <= 10) {
    tier = 'RETAIL'
    multiplier = 1
  } else if (quantity <= 100) {
    tier = 'WHOLESALE'
    multiplier = 0.9 // 10% off
  } else {
    tier = 'VIP'
    multiplier = 0.85 // 15% off
  }

  const unitPrice = price * multiplier
  return {
    tier,
    price: convertPrice(unitPrice, currency),
    total: convertPrice(unitPrice * quantity, currency),
  }
}

export interface TierPrice {
  minQty: number
  maxQty: number | null // null means unlimited
  price: number
}

export function getTieredPricing(tieredPricingStr: string | null | undefined, basePrice: number): TierPrice[] {
  // Default tiers if no tiered pricing is set
  const defaultTiers: TierPrice[] = [
    { minQty: 1, maxQty: 10, price: basePrice },
    { minQty: 11, maxQty: 100, price: basePrice * 0.9 },
    { minQty: 101, maxQty: null, price: basePrice * 0.85 },
  ]

  if (!tieredPricingStr) {
    return defaultTiers
  }

  try {
    const parsed = JSON.parse(tieredPricingStr)
    if (parsed && Array.isArray(parsed.tiers) && parsed.tiers.length > 0) {
      return parsed.tiers.map((t: any) => ({
        minQty: t.minQty ?? 1,
        maxQty: t.maxQty ?? null,
        price: t.price ?? basePrice,
      }))
    }
  } catch {
    // Invalid JSON, return defaults
  }

  return defaultTiers
}

export function getPriceFromTieredPricing(
  tieredPricing: TierPrice[],
  quantity: number
): { tier: string; price: number; total: number } {
  const tier = tieredPricing.find(t => {
    if (t.maxQty === null) {
      return quantity >= t.minQty
    }
    return quantity >= t.minQty && quantity <= t.maxQty
  })

  if (!tier) {
    // Fallback to first tier
    return {
      tier: 'RETAIL',
      price: tieredPricing[0]?.price ?? 0,
      total: (tieredPricing[0]?.price ?? 0) * quantity,
    }
  }

  return {
    tier: tier.minQty >= 101 ? 'VIP' : tier.minQty >= 11 ? 'WHOLESALE' : 'RETAIL',
    price: tier.price,
    total: tier.price * quantity,
  }
}

export function getCurrencyFromTimezone(timezone: string): Currency {
  const currencyMap: Record<string, Currency> = {
    'America/New_York': 'USD',
    'America/Los_Angeles': 'USD',
    'America/Chicago': 'USD',
    'America/Denver': 'USD',
    'America/Phoenix': 'USD',
    'America/Toronto': 'USD',
    'America/Vancouver': 'USD',
    'America/Mexico_City': 'MXN',
    'America/Cancun': 'MXN',
    'America/Monterrey': 'MXN',
    'America/Sao_Paulo': 'BRL',
    'America/Rio_Branco': 'BRL',
    'America/Brasilia': 'BRL',
    'America/Buenos_Aires': 'BRL',
    'America/Lima': 'BRL',
    'America/Bogota': 'BRL',
    'America/Santiago': 'BRL',
  }

  return currencyMap[timezone] || 'USD'
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  })
}

export function formatOrderNumber(orderNumber: string): string {
  return `#${orderNumber}`
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `JH-${timestamp}-${random}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function calculateShipping(
  subtotal: number,
  zone: 'NORTH_AMERICA' | 'SOUTH_AMERICA'
): { cost: number; free: boolean } {
  const zones = {
    NORTH_AMERICA: { price: 12.99, freeThreshold: 299 },
    SOUTH_AMERICA: { price: 18.99, freeThreshold: 499 },
  }
  
  const { price, freeThreshold } = zones[zone]
  return {
    cost: subtotal >= freeThreshold ? 0 : price,
    free: subtotal >= freeThreshold,
  }
}

export function getWhatsAppLink(phone: string, message?: string): string {
  const cleanPhone = phone.replace(/\D/g, '')
  const encodedMessage = message ? encodeURIComponent(message) : ''
  return `https://wa.me/${cleanPhone}${encodedMessage ? `?text=${encodedMessage}` : ''}`
}

export function getTikTokShareLink(url: string, text?: string): string {
  const encodedUrl = encodeURIComponent(url)
  const encodedText = text ? encodeURIComponent(text) : ''
  return `https://www.tiktok.com/share/item?url=${encodedUrl}&text=${encodedText}`
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function parseSearchParams(searchParams: URLSearchParams) {
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const sort = searchParams.get('sort') || 'featured'
  const minPrice = searchParams.get('minPrice')
  const maxPrice = searchParams.get('maxPrice')
  const inStock = searchParams.get('inStock') === 'true'
  
  return { category, search, sort, minPrice, maxPrice, inStock }
}

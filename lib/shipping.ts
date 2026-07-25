// Shipping cost calculation based on weight and destination
// Database-driven rates with fallback defaults

import { prisma } from '@/lib/prisma'

interface ShippingRate {
  name: string
  baseCost: number
  costPerKg: number
  estimatedDays: string
  freeThreshold: number
}

interface ShippingMethod {
  id: string
  name: string
  code: string
  baseCost: number
  costPerKg: number
  estimatedDays: string
  isActive: boolean
  freeThreshold: number
}

// Default shipping zones (fallback)
const defaultShippingZones: Record<string, ShippingRate[]> = {
  'US': [
    { name: 'Standard Shipping', baseCost: 9.99, costPerKg: 2.99, estimatedDays: '5-7 days', freeThreshold: 199 },
    { name: 'Express Shipping', baseCost: 19.99, costPerKg: 4.99, estimatedDays: '2-3 days', freeThreshold: 299 },
  ],
  'CA': [
    { name: 'Standard to Canada', baseCost: 12.99, costPerKg: 3.99, estimatedDays: '7-10 days', freeThreshold: 199 },
    { name: 'Express to Canada', baseCost: 24.99, costPerKg: 6.99, estimatedDays: '3-5 days', freeThreshold: 299 },
  ],
  'GB': [
    { name: 'Standard to UK', baseCost: 11.99, costPerKg: 3.99, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to UK', baseCost: 24.99, costPerKg: 6.99, estimatedDays: '3-5 days', freeThreshold: 299 },
  ],
  'DE': [
    { name: 'Standard to Germany', baseCost: 13.99, costPerKg: 4.29, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Germany', baseCost: 27.99, costPerKg: 7.49, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'HK': [
    { name: 'Standard to Hong Kong', baseCost: 9.99, costPerKg: 2.49, estimatedDays: '3-5 days', freeThreshold: 99 },
    { name: 'Express to Hong Kong', baseCost: 19.99, costPerKg: 4.99, estimatedDays: '1-2 days', freeThreshold: 199 },
  ],
  'TW': [
    { name: 'Standard to Taiwan', baseCost: 12.99, costPerKg: 3.49, estimatedDays: '4-7 days', freeThreshold: 149 },
    { name: 'Express to Taiwan', baseCost: 24.99, costPerKg: 5.99, estimatedDays: '2-3 days', freeThreshold: 249 },
  ],
}

// ShippingOption interface
export interface ShippingOption {
  id: string
  name: string
  code: string
  baseCost: number
  costPerKg: number
  estimatedDays: string
  isActive: boolean
  freeThreshold: number
  cost?: number
  isFree?: boolean
  description?: string
}

// Get shipping methods for a country (from DB or defaults)
export function getShippingMethods(countryCode: string): ShippingMethod[] {
  const zones = defaultShippingZones[countryCode]
  if (!zones) {
    return [
      {
        id: `shipping_${countryCode}_0`,
        name: 'Standard Shipping',
        code: `${countryCode}_0`,
        baseCost: 19.99,
        costPerKg: 5.99,
        estimatedDays: '10-14 days',
        isActive: true,
        freeThreshold: 299,
      }
    ]
  }

  return zones.map((rate, index) => ({
    id: `shipping_${countryCode}_${index}`,
    name: rate.name,
    code: `${countryCode}_${index}`,
    baseCost: rate.baseCost,
    costPerKg: rate.costPerKg,
    estimatedDays: rate.estimatedDays,
    isActive: true,
    freeThreshold: rate.freeThreshold,
  }))
}

// Calculate total weight from items
export function calculateTotalWeight(items: { weight?: number | null; quantity: number }[]): number {
  return items.reduce((total, item) => {
    const weight = item.weight || 0
    return total + (weight * item.quantity)
  }, 0)
}

// Calculate shipping options with costs
export function calculateShipping(
  countryCode: string,
  totalWeight: number,
  subtotal: number
): ShippingOption[] {
  const methods = getShippingMethods(countryCode)
  
  return methods.map(method => {
    const isFree = method.freeThreshold > 0 && subtotal >= method.freeThreshold
    const weightCost = totalWeight * method.costPerKg
    const cost = isFree ? 0 : method.baseCost + weightCost
    
    return {
      ...method,
      cost,
      isFree,
      description: isFree 
        ? `Free shipping on orders over $${method.freeThreshold}!`
        : method.estimatedDays
    }
  })
}

// Get estimated days
export function getEstimatedDays(countryCode: string, shippingMethodCode: string): string {
  const methods = getShippingMethods(countryCode)
  const method = methods.find(m => m.code === shippingMethodCode)
  return method?.estimatedDays || '7-14 days'
}

// Check if country is supported
export function isCountrySupported(countryCode: string): boolean {
  return countryCode in defaultShippingZones
}

// Get all supported country codes
export function getSupportedCountries(): string[] {
  return Object.keys(defaultShippingZones)
}

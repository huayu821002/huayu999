// Shipping cost calculation - database-driven

import { prisma } from '@/lib/prisma'

export interface ShippingMethod {
  id: string
  name: string
  code: string
  baseCost: number
  costPerKg: number
  estimatedDays: string
  isActive: boolean
  freeThreshold: number
  minWeight: number
  maxWeight: number
  sortOrder: number
}

export interface ShippingOption {
  id: string
  methodId: string
  name: string
  code: string
  description: string
  estimatedDays: string
  cost: number
  freeShipping: boolean
  isFree?: boolean  // alias for freeShipping, used by checkout
  available: boolean
  reason?: string
}

// Default fallback rates
const defaultRates: Record<string, ShippingOption[]> = {
  'US': [
    { id: 'def_us_std', methodId: '', name: 'Standard Shipping', code: 'US_STD', description: 'Standard', estimatedDays: '10-14 days', cost: 0, freeShipping: false, isFree: false, available: true },
    { id: 'def_us_exp', methodId: '', name: 'Express Shipping', code: 'US_EXP', description: 'Express', estimatedDays: '5-7 days', cost: 0, freeShipping: false, isFree: false, available: true },
  ],
  'DEFAULT': [
    { id: 'def_default', methodId: '', name: 'Standard Shipping', code: 'DEFAULT', description: 'Standard', estimatedDays: '10-20 days', cost: 0, freeShipping: false, isFree: false, available: true },
  ],
}

// Get all active shipping rates for a country code, grouped by method
export async function getShippingRatesForCountry(countryCode: string): Promise<ShippingOption[]> {
  try {
    // Find all rates for this country (or country code patterns)
    const rates = await prisma.shippingRate.findMany({
      where: {
        isActive: true,
        OR: [
          { countryCode: countryCode.toUpperCase() },
          { countryCode: 'ALL' },
        ]
      },
      include: {
        method: {
          select: { name: true, code: true, description: true }
        }
      },
      orderBy: { sortOrder: 'asc' },
    })

    if (rates.length === 0) {
      // No shipping rates configured - return empty
      return []
    }

    return rates.map((rate: any) => ({
      id: rate.id,
      methodId: rate.methodId || '',
      name: rate.method?.name || 'Standard',
      code: `${rate.method?.code || 'STD'}_${rate.countryCode}`,
      description: rate.method?.description || '',
      estimatedDays: rate.estimatedDays || '10-14 days',
      cost: 0, // calculated later
      freeShipping: false, // calculated later
      available: true,
    }))
  } catch (error) {
    console.error('Error fetching shipping rates:', error)
    return defaultRates['DEFAULT'].map(r => ({ ...r }))
  }
}

// Calculate shipping options for checkout
export async function calculateShippingOptions(
  countryCode: string,
  totalWeight: number,
  subtotal: number
): Promise<ShippingOption[]> {
  try {
    const rates = await prisma.shippingRate.findMany({
      where: {
        isActive: true,
        OR: [
          { countryCode: countryCode.toUpperCase() },
          { countryCode: 'ALL' },
        ]
      },
      include: {
        method: true
      },
      orderBy: { sortOrder: 'asc' },
    })

    if (rates.length === 0) {
      // No shipping templates configured - return empty
      return []
    }

    return rates.map((rate: any) => {
      // Weight constraints
      if (rate.minWeight > 0 && totalWeight < rate.minWeight) {
        return {
          id: rate.id,
          methodId: rate.methodId || '',
          name: rate.method?.name || 'Standard',
          code: `${rate.method?.code || 'STD'}_${rate.countryCode}`,
          description: rate.method?.description || '',
          estimatedDays: rate.estimatedDays || '10-14 days',
          cost: 0,
          freeShipping: false,
          isFree: false,
          available: false,
          reason: `Min ${rate.minWeight}kg required`,
        }
      }
      if (rate.maxWeight > 0 && totalWeight > rate.maxWeight) {
        return {
          id: rate.id,
          methodId: rate.methodId || '',
          name: rate.method?.name || 'Standard',
          code: `${rate.method?.code || 'STD'}_${rate.countryCode}`,
          description: rate.method?.description || '',
          estimatedDays: rate.estimatedDays || '10-14 days',
          cost: 0,
          freeShipping: false,
          isFree: false,
          available: false,
          reason: `Max ${rate.maxWeight}kg allowed`,
        }
      }

      // Calculate cost
      const weightCost = totalWeight * rate.costPerKg
      const isFree = rate.freeThreshold > 0 && subtotal >= rate.freeThreshold
      const cost = isFree ? 0 : rate.baseCost + weightCost

      return {
        id: rate.id,
        methodId: rate.methodId || '',
        name: rate.method?.name || 'Standard',
        code: `${rate.method?.code || 'STD'}_${rate.countryCode}`,
        description: rate.method?.description || '',
        estimatedDays: rate.estimatedDays || '10-14 days',
        cost,
        freeShipping: isFree,
        isFree,
        available: true,
      }
    })
  } catch (error) {
    console.error('Error calculating shipping:', error)
    return [{
      id: 'error',
      methodId: '',
      name: 'Standard Shipping',
      code: 'ERR',
      description: 'Shipping calculation unavailable',
      estimatedDays: 'Contact us',
      cost: 0,
      freeShipping: false,
      isFree: false,
      available: true,
    }]
  }
}

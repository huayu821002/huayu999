// Shipping cost calculation based on weight and destination
// Supports both database-driven rates and fallback defaults

interface ShippingRate {
  name: string
  baseCost: number  // Base cost in USD
  costPerKg: number // Additional cost per kg
  estimatedDays: string
  freeThreshold: number // Free shipping if subtotal exceeds this
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

// Default shipping zones (used as fallback or initial data)
const defaultShippingZones: Record<string, ShippingRate[]> = {
  // North America
  'US': [
    { name: 'Standard Shipping', baseCost: 9.99, costPerKg: 2.99, estimatedDays: '5-7 days', freeThreshold: 199 },
    { name: 'Express Shipping', baseCost: 19.99, costPerKg: 4.99, estimatedDays: '2-3 days', freeThreshold: 299 },
  ],
  'CA': [
    { name: 'Standard to Canada', baseCost: 12.99, costPerKg: 3.99, estimatedDays: '7-10 days', freeThreshold: 199 },
    { name: 'Express to Canada', baseCost: 24.99, costPerKg: 6.99, estimatedDays: '3-5 days', freeThreshold: 299 },
  ],
  'MX': [
    { name: 'Standard to Mexico', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Mexico', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],

  // Europe
  'GB': [
    { name: 'Standard to UK', baseCost: 11.99, costPerKg: 3.99, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to UK', baseCost: 24.99, costPerKg: 6.99, estimatedDays: '3-5 days', freeThreshold: 299 },
  ],
  'DE': [
    { name: 'Standard to Germany', baseCost: 13.99, costPerKg: 4.29, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Germany', baseCost: 27.99, costPerKg: 7.49, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'FR': [
    { name: 'Standard to France', baseCost: 13.99, costPerKg: 4.29, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to France', baseCost: 27.99, costPerKg: 7.49, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'NL': [
    { name: 'Standard to Netherlands', baseCost: 13.99, costPerKg: 4.29, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Netherlands', baseCost: 27.99, costPerKg: 7.49, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'IT': [
    { name: 'Standard to Italy', baseCost: 13.99, costPerKg: 4.29, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Italy', baseCost: 27.99, costPerKg: 7.49, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'ES': [
    { name: 'Standard to Spain', baseCost: 13.99, costPerKg: 4.29, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Spain', baseCost: 27.99, costPerKg: 7.49, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'PL': [
    { name: 'Standard to Poland', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Poland', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'BE': [
    { name: 'Standard to Belgium', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Belgium', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'SE': [
    { name: 'Standard to Sweden', baseCost: 15.99, costPerKg: 4.99, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Sweden', baseCost: 32.99, costPerKg: 8.99, estimatedDays: '4-6 days', freeThreshold: 349 },
  ],
  'AT': [
    { name: 'Standard to Austria', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Austria', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'PT': [
    { name: 'Standard to Portugal', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Portugal', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'GR': [
    { name: 'Standard to Greece', baseCost: 15.99, costPerKg: 4.99, estimatedDays: '9-14 days', freeThreshold: 199 },
    { name: 'Express to Greece', baseCost: 34.99, costPerKg: 8.99, estimatedDays: '5-7 days', freeThreshold: 349 },
  ],
  'CZ': [
    { name: 'Standard to Czech Republic', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Czech Republic', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'RO': [
    { name: 'Standard to Romania', baseCost: 15.99, costPerKg: 4.99, estimatedDays: '9-14 days', freeThreshold: 199 },
    { name: 'Express to Romania', baseCost: 34.99, costPerKg: 8.99, estimatedDays: '5-7 days', freeThreshold: 349 },
  ],
  'HU': [
    { name: 'Standard to Hungary', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Hungary', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],
  'CH': [
    { name: 'Standard to Switzerland', baseCost: 15.99, costPerKg: 4.99, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Switzerland', baseCost: 34.99, costPerKg: 8.99, estimatedDays: '4-6 days', freeThreshold: 349 },
  ],
  'NO': [
    { name: 'Standard to Norway', baseCost: 16.99, costPerKg: 5.49, estimatedDays: '9-14 days', freeThreshold: 249 },
    { name: 'Express to Norway', baseCost: 39.99, costPerKg: 10.99, estimatedDays: '5-7 days', freeThreshold: 399 },
  ],
  'DK': [
    { name: 'Standard to Denmark', baseCost: 15.99, costPerKg: 4.99, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Denmark', baseCost: 34.99, costPerKg: 8.99, estimatedDays: '4-6 days', freeThreshold: 349 },
  ],
  'FI': [
    { name: 'Standard to Finland', baseCost: 16.99, costPerKg: 5.49, estimatedDays: '9-14 days', freeThreshold: 249 },
    { name: 'Express to Finland', baseCost: 39.99, costPerKg: 10.99, estimatedDays: '5-7 days', freeThreshold: 399 },
  ],
  'IE': [
    { name: 'Standard to Ireland', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '8-12 days', freeThreshold: 199 },
    { name: 'Express to Ireland', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '4-6 days', freeThreshold: 299 },
  ],

  // Asia Pacific
  'HK': [
    { name: 'Standard to Hong Kong', baseCost: 9.99, costPerKg: 2.49, estimatedDays: '3-5 days', freeThreshold: 99 },
    { name: 'Express to Hong Kong', baseCost: 19.99, costPerKg: 4.99, estimatedDays: '1-2 days', freeThreshold: 199 },
  ],
  'MO': [
    { name: 'Standard to Macau', baseCost: 9.99, costPerKg: 2.49, estimatedDays: '3-5 days', freeThreshold: 99 },
    { name: 'Express to Macau', baseCost: 19.99, costPerKg: 4.99, estimatedDays: '1-2 days', freeThreshold: 199 },
  ],
  'TW': [
    { name: 'Standard to Taiwan', baseCost: 12.99, costPerKg: 3.49, estimatedDays: '4-7 days', freeThreshold: 149 },
    { name: 'Express to Taiwan', baseCost: 24.99, costPerKg: 5.99, estimatedDays: '2-3 days', freeThreshold: 249 },
  ],
  'JP': [
    { name: 'Standard to Japan', baseCost: 14.99, costPerKg: 4.99, estimatedDays: '7-10 days', freeThreshold: 199 },
    { name: 'Express to Japan', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '3-5 days', freeThreshold: 299 },
  ],
  'KR': [
    { name: 'Standard to Korea', baseCost: 14.99, costPerKg: 4.99, estimatedDays: '7-10 days', freeThreshold: 199 },
    { name: 'Express to Korea', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '3-5 days', freeThreshold: 299 },
  ],
  'SG': [
    { name: 'Standard to Singapore', baseCost: 9.99, costPerKg: 2.99, estimatedDays: '3-5 days', freeThreshold: 99 },
    { name: 'Express to Singapore', baseCost: 17.99, costPerKg: 4.99, estimatedDays: '1-2 days', freeThreshold: 199 },
  ],
  'MY': [
    { name: 'Standard to Malaysia', baseCost: 11.99, costPerKg: 3.29, estimatedDays: '5-8 days', freeThreshold: 149 },
    { name: 'Express to Malaysia', baseCost: 22.99, costPerKg: 5.99, estimatedDays: '2-3 days', freeThreshold: 249 },
  ],
  'TH': [
    { name: 'Standard to Thailand', baseCost: 12.99, costPerKg: 3.49, estimatedDays: '6-10 days', freeThreshold: 149 },
    { name: 'Express to Thailand', baseCost: 24.99, costPerKg: 5.99, estimatedDays: '2-3 days', freeThreshold: 299 },
  ],
  'VN': [
    { name: 'Standard to Vietnam', baseCost: 12.99, costPerKg: 3.49, estimatedDays: '6-10 days', freeThreshold: 149 },
    { name: 'Express to Vietnam', baseCost: 24.99, costPerKg: 5.99, estimatedDays: '2-3 days', freeThreshold: 299 },
  ],
  'PH': [
    { name: 'Standard to Philippines', baseCost: 12.99, costPerKg: 3.49, estimatedDays: '7-12 days', freeThreshold: 149 },
    { name: 'Express to Philippines', baseCost: 27.99, costPerKg: 6.99, estimatedDays: '3-5 days', freeThreshold: 299 },
  ],
  'ID': [
    { name: 'Standard to Indonesia', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '8-14 days', freeThreshold: 199 },
    { name: 'Express to Indonesia', baseCost: 29.99, costPerKg: 7.99, estimatedDays: '4-6 days', freeThreshold: 349 },
  ],
  'NZ': [
    { name: 'Standard to New Zealand', baseCost: 17.99, costPerKg: 5.49, estimatedDays: '10-14 days', freeThreshold: 249 },
    { name: 'Express to New Zealand', baseCost: 39.99, costPerKg: 10.99, estimatedDays: '5-7 days', freeThreshold: 399 },
  ],
  'AU': [
    { name: 'Standard to Australia', baseCost: 14.99, costPerKg: 4.99, estimatedDays: '10-14 days', freeThreshold: 249 },
    { name: 'Express to Australia', baseCost: 34.99, costPerKg: 9.99, estimatedDays: '5-7 days', freeThreshold: 399 },
  ],
  'IN': [
    { name: 'Standard to India', baseCost: 14.99, costPerKg: 4.49, estimatedDays: '10-14 days', freeThreshold: 199 },
    { name: 'Express to India', baseCost: 32.99, costPerKg: 8.99, estimatedDays: '5-7 days', freeThreshold: 349 },
  ],

  // South America
  'BR': [
    { name: 'Standard to Brazil', baseCost: 17.99, costPerKg: 5.99, estimatedDays: '12-18 days', freeThreshold: 249 },
    { name: 'Express to Brazil', baseCost: 39.99, costPerKg: 11.99, estimatedDays: '6-8 days', freeThreshold: 399 },
  ],
  'AR': [
    { name: 'Standard to Argentina', baseCost: 17.99, costPerKg: 5.99, estimatedDays: '12-18 days', freeThreshold: 249 },
    { name: 'Express to Argentina', baseCost: 39.99, costPerKg: 11.99, estimatedDays: '6-8 days', freeThreshold: 399 },
  ],
  'CO': [
    { name: 'Standard to Colombia', baseCost: 17.99, costPerKg: 5.99, estimatedDays: '12-18 days', freeThreshold: 249 },
    { name: 'Express to Colombia', baseCost: 39.99, costPerKg: 11.99, estimatedDays: '6-8 days', freeThreshold: 399 },
  ],
  'PE': [
    { name: 'Standard to Peru', baseCost: 19.99, costPerKg: 6.49, estimatedDays: '14-20 days', freeThreshold: 299 },
    { name: 'Express to Peru', baseCost: 44.99, costPerKg: 12.99, estimatedDays: '7-10 days', freeThreshold: 449 },
  ],
  'CL': [
    { name: 'Standard to Chile', baseCost: 17.99, costPerKg: 5.99, estimatedDays: '12-18 days', freeThreshold: 249 },
    { name: 'Express to Chile', baseCost: 39.99, costPerKg: 10.99, estimatedDays: '6-8 days', freeThreshold: 399 },
  ],
}

// Default rates for countries not explicitly listed
const defaultRates: ShippingRate[] = [
  { name: 'Economy International', baseCost: 19.99, costPerKg: 5.99, estimatedDays: '14-21 days', freeThreshold: 299 },
  { name: 'Standard International', baseCost: 29.99, costPerKg: 8.99, estimatedDays: '10-14 days', freeThreshold: 399 },
  { name: 'Express International', baseCost: 49.99, costPerKg: 14.99, estimatedDays: '5-7 days', freeThreshold: 599 },
]

// Get shipping methods for a country
export function getShippingMethods(countryCode: string): ShippingMethod[] {
  const zones = defaultShippingZones[countryCode]
  if (!zones) {
    return defaultRates.map((rate, index) => ({
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

// Calculate shipping cost based on weight and selected method
export function calculateShipping(
  countryCode: string,
  totalWeight: number,
  subtotal: number,
  shippingMethodCode: string
): number {
  const methods = getShippingMethods(countryCode)
  const method = methods.find(m => m.code === shippingMethodCode)
  
  if (!method) {
    return 0
  }

  // Check free shipping threshold
  if (method.freeThreshold > 0 && subtotal >= method.freeThreshold) {
    return 0
  }

  // Calculate cost: base + (weight * costPerKg)
  const weightCost = totalWeight * method.costPerKg
  return method.baseCost + weightCost
}

export interface ShippingOption {
  id: string
  name: string
  code: string
  baseCost: number
  costPerKg: number
  estimatedDays: string
  isActive: boolean
  freeThreshold: number
}
  return items.reduce((total, item) => {
    const weight = item.weight || 0
    return total + (weight * item.quantity)
  }, 0)
}

// Get estimated days
export function getEstimatedDays(countryCode: string, shippingMethodCode: string): string {
  const methods = getShippingMethods(countryCode)
  const method = methods.find(m => m.code === shippingMethodCode)
  return method?.estimatedDays || '7-14 days'
}

// Check if country is supported
export function isCountrySupported(countryCode: string): boolean {
  return countryCode in defaultShippingZones || true // Allow all countries with default rates
}

// Get all supported country codes
export function getSupportedCountries(): string[] {
  return Object.keys(defaultShippingZones)
}

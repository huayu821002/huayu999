"use client"

export interface Country {
  code: string
  name: string
}

export interface Zone {
  id: string
  name: string
  countries: Country[]
}

export const SHIPPING_ZONES: Zone[] = [
  {
    id: 'north_america',
    name: 'North America',
    countries: [
      { code: 'US', name: 'United States' },
      { code: 'CA', name: 'Canada' },
      { code: 'MX', name: 'Mexico' },
    ]
  },
  {
    id: 'south_america',
    name: 'South America',
    countries: [
      { code: 'BR', name: 'Brazil' },
      { code: 'AR', name: 'Argentina' },
      { code: 'CL', name: 'Chile' },
      { code: 'CO', name: 'Colombia' },
      { code: 'PE', name: 'Peru' },
    ]
  },
  {
    id: 'europe',
    name: 'Europe',
    countries: [
      { code: 'GB', name: 'United Kingdom' },
      { code: 'DE', name: 'Germany' },
      { code: 'FR', name: 'France' },
      { code: 'IT', name: 'Italy' },
      { code: 'ES', name: 'Spain' },
      { code: 'NL', name: 'Netherlands' },
      { code: 'BE', name: 'Belgium' },
      { code: 'PL', name: 'Poland' },
      { code: 'SE', name: 'Sweden' },
      { code: 'NO', name: 'Norway' },
      { code: 'DK', name: 'Denmark' },
      { code: 'FI', name: 'Finland' },
      { code: 'AT', name: 'Austria' },
      { code: 'CH', name: 'Switzerland' },
      { code: 'PT', name: 'Portugal' },
      { code: 'GR', name: 'Greece' },
      { code: 'CZ', name: 'Czech Republic' },
      { code: 'HU', name: 'Hungary' },
      { code: 'RO', name: 'Romania' },
      { code: 'IE', name: 'Ireland' },
    ]
  },
  {
    id: 'asia_pacific',
    name: 'Asia Pacific',
    countries: [
      { code: 'CN', name: 'China' },
      { code: 'JP', name: 'Japan' },
      { code: 'KR', name: 'South Korea' },
      { code: 'HK', name: 'Hong Kong' },
      { code: 'TW', name: 'Taiwan' },
      { code: 'SG', name: 'Singapore' },
      { code: 'MY', name: 'Malaysia' },
      { code: 'TH', name: 'Thailand' },
      { code: 'VN', name: 'Vietnam' },
      { code: 'PH', name: 'Philippines' },
      { code: 'ID', name: 'Indonesia' },
      { code: 'IN', name: 'India' },
      { code: 'AU', name: 'Australia' },
      { code: 'NZ', name: 'New Zealand' },
    ]
  },
  {
    id: 'middle_east',
    name: 'Middle East',
    countries: [
      { code: 'AE', name: 'United Arab Emirates' },
      { code: 'SA', name: 'Saudi Arabia' },
      { code: 'IL', name: 'Israel' },
      { code: 'TR', name: 'Turkey' },
      { code: 'QA', name: 'Qatar' },
      { code: 'KW', name: 'Kuwait' },
      { code: 'EG', name: 'Egypt' },
    ]
  },
  {
    id: 'africa',
    name: 'Africa',
    countries: [
      { code: 'ZA', name: 'South Africa' },
      { code: 'NG', name: 'Nigeria' },
      { code: 'KE', name: 'Kenya' },
      { code: 'MA', name: 'Morocco' },
    ]
  },
]

// Flatten all countries into a simple array
export const ALL_COUNTRIES: Country[] = SHIPPING_ZONES.flatMap(zone => zone.countries)

// Get zone by country code
export function getZoneByCountryCode(code: string): Zone | undefined {
  return SHIPPING_ZONES.find(zone => zone.countries.some(c => c.code === code))
}

// Get country by code
export function getCountryByCode(code: string): Country | undefined {
  return ALL_COUNTRIES.find(c => c.code === code)
}

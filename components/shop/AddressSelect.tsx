'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/ui/Icons'
import { countries, getStatesByCountry, getCitiesByState } from '@/lib/countries'

interface AddressData {
  country: string
  state: string
  city: string
  street: string
  zip: string
}

interface AddressSelectProps {
  value: AddressData
  onChange: (address: AddressData) => void
  compact?: boolean
}

export function AddressSelect({ value, onChange, compact = false }: AddressSelectProps) {
  const [states, setStates] = useState<{ code: string; name: string }[]>([])
  const [cities, setCities] = useState<string[]>([])

  // Update states when country changes
  useEffect(() => {
    if (value.country) {
      const countryStates = getStatesByCountry(value.country)
      setStates(countryStates)
      
      // Reset state and city if they don't exist in new country
      if (value.state) {
        const stateExists = countryStates.some(s => s.code === value.state)
        if (!stateExists) {
          onChange({ ...value, state: '', city: '' })
        }
      }
    } else {
      setStates([])
    }
  }, [value.country])

  // Update cities when state changes
  useEffect(() => {
    if (value.country && value.state) {
      const stateCities = getCitiesByState(value.country, value.state)
      setCities(stateCities)
      
      // Reset city if it doesn't exist in new state
      if (value.city) {
        const cityExists = stateCities.some(c => c === value.city)
        if (!cityExists) {
          onChange({ ...value, city: '' })
        }
      }
    } else {
      setCities([])
    }
  }, [value.country, value.state])

  const handleChange = (field: keyof AddressData, newValue: string) => {
    onChange({ ...value, [field]: newValue })
  }

  const selectedCountry = countries.find(c => c.code === value.country)

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {/* Country */}
      <div>
        <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
          Country *
        </label>
        <select
          value={value.country}
          onChange={(e) => handleChange('country', e.target.value)}
          className={cn(
            'w-full rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none',
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'
          )}
        >
          <option value="">Select Country</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </div>

      {/* State/Province */}
      <div>
        <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
          State/Province *
        </label>
        <select
          value={value.state}
          onChange={(e) => handleChange('state', e.target.value)}
          disabled={!value.country || states.length === 0}
          className={cn(
            'w-full rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none',
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-3',
            (!value.country || states.length === 0) && 'bg-joy-gray-50 cursor-not-allowed'
          )}
        >
          <option value="">
            {value.country ? (states.length > 0 ? 'Select State/Province' : 'No states available') : 'Select Country First'}
          </option>
          {states.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>
      </div>

      {/* City */}
      <div>
        <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
          City *
        </label>
        <select
          value={value.city}
          onChange={(e) => handleChange('city', e.target.value)}
          disabled={!value.state || cities.length === 0}
          className={cn(
            'w-full rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none',
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-3',
            (!value.state || cities.length === 0) && 'bg-joy-gray-50 cursor-not-allowed'
          )}
        >
          <option value="">
            {value.state ? (cities.length > 0 ? 'Select City' : 'No cities available') : 'Select State First'}
          </option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      {/* Street Address */}
      <div>
        <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
          Street Address *
        </label>
        <input
          type="text"
          value={value.street}
          onChange={(e) => handleChange('street', e.target.value)}
          placeholder="123 Main St, Apt 4B, Building name, etc."
          className={cn(
            'w-full rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none',
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'
          )}
        />
      </div>

      {/* ZIP/Postal Code */}
      <div>
        <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
          ZIP/Postal Code
        </label>
        <input
          type="text"
          value={value.zip}
          onChange={(e) => handleChange('zip', e.target.value)}
          placeholder="12345 or ABC 123"
          className={cn(
            'w-full rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none',
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'
          )}
        />
      </div>
    </div>
  )
}

// Simplified single-line address display
export function formatAddress(address: AddressData): string {
  if (!address.country) return ''
  
  const parts = [
    address.street,
    address.city,
    address.state,
    address.country,
    address.zip,
  ].filter(Boolean)
  
  return parts.join(', ')
}

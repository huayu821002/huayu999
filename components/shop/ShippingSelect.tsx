'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/ui/Icons'
import { calculateShipping, calculateTotalWeight, ShippingOption } from '@/lib/shipping'

interface ShippingSelectProps {
  items: { productId: string; quantity: number; weight?: number | null; price: number }[]
  subtotal: number
  country: string
  value: string // selected shipping option id
  onChange: (option: ShippingOption) => void
}

export function ShippingSelect({ items, subtotal, country, value, onChange }: ShippingSelectProps) {
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!country) {
      setShippingOptions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    
    // Calculate total weight
    const totalWeight = calculateTotalWeight(items)
    
    // Get shipping options
    const options = calculateShipping(country, totalWeight, subtotal)
    setShippingOptions(options)
    setIsLoading(false)

    // Auto-select first option if none selected
    if (!value && options.length > 0) {
      onChange(options[0])
    }
  }, [country, items, subtotal])

  if (!country) {
    return (
      <div className="p-4 bg-joy-gray-50 rounded-xl text-sm text-joy-gray-500 text-center">
        Please select a country first to see shipping options
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4 bg-joy-gray-50 rounded-xl text-sm text-joy-gray-500 text-center">
        Calculating shipping...
      </div>
    )
  }

  if (shippingOptions.length === 0) {
    return (
      <div className="p-4 bg-joy-gray-50 rounded-xl text-sm text-joy-gray-500 text-center">
        No shipping available for this location
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {shippingOptions.map((option) => (
        <label
          key={option.id}
          className={cn(
            'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
            value === option.id
              ? 'border-joy-orange bg-joy-orange/5'
              : 'border-joy-gray-200 hover:border-joy-gray-300'
          )}
        >
          <input
            type="radio"
            name="shipping"
            value={option.id}
            checked={value === option.id}
            onChange={() => onChange(option)}
            className="w-4 h-4 text-joy-orange"
          />
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-joy-gray-900">{option.name}</span>
              {option.isFree && (
                <span className="px-2 py-0.5 bg-joy-green/10 text-joy-green text-xs font-medium rounded-full">
                  FREE
                </span>
              )}
            </div>
            <p className="text-sm text-joy-gray-500">{option.description}</p>
          </div>
          
          <div className="text-right">
            {option.isFree ? (
              <span className="font-bold text-joy-green">FREE</span>
            ) : (
              <span className="font-bold text-joy-gray-900">${option.cost.toFixed(2)}</span>
            )}
          </div>
        </label>
      ))}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { cn, formatCurrency, getPriceByTier } from '@/lib/utils'
import { Icons } from '@/components/ui/Icons'
import { Input } from '@/components/ui/Input'
import type { Product, Currency } from '@/types'

interface BatchProductCardProps {
  product: Product
  currency?: Currency
  selected: boolean
  quantity: number
  onToggleSelect: (productId: string) => void
  onQuantityChange: (productId: string, qty: number) => void
}

export function BatchProductCard({
  product,
  currency = 'USD',
  selected,
  quantity,
  onToggleSelect,
  onQuantityChange,
}: BatchProductCardProps) {
  // Parse images
  const images: string[] = (() => {
    if (!product.images) return []
    if (Array.isArray(product.images)) return product.images
    try { return JSON.parse(product.images as string) } catch { return [product.images] }
  })()

  const hasDiscount = product.comparePrice && product.comparePrice > product.price
  
  // Calculate price based on quantity tier
  const currentPrice = getPriceByTier(product.price, quantity, currency).price
  const isOutOfStock = product.inventory === 0

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0
    onQuantityChange(product.id, Math.max(product.minOrderQty || 1, val))
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border-2 transition-all',
        selected ? 'border-joy-orange shadow-lg' : 'border-joy-gray-100 hover:border-joy-gray-200',
        isOutOfStock && 'opacity-60'
      )}
    >
      {/* Selection Header */}
      <div className="p-3 border-b border-joy-gray-100 flex items-center gap-3">
        <button
          onClick={() => onToggleSelect(product.id)}
          className={cn(
            'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0',
            selected 
              ? 'bg-joy-orange border-joy-orange text-white' 
              : 'border-joy-gray-300 hover:border-joy-orange'
          )}
        >
          {selected && <Icons.Check size={14} />}
        </button>
        
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg bg-joy-gray-100 overflow-hidden flex-shrink-0">
          <img 
            src={images[0] || '/placeholder.png'} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-joy-gray-900 text-sm line-clamp-1">{product.name}</h3>
          <p className="text-xs text-joy-gray-400">SKU: {product.sku || 'N/A'}</p>
        </div>

        {/* Out of Stock Badge */}
        {isOutOfStock && (
          <span className="text-xs bg-joy-gray-200 text-joy-gray-600 px-2 py-1 rounded">
            Out of Stock
          </span>
        )}
      </div>

      {/* Product Details */}
      <div className="p-3 space-y-3">
        {/* Price Row */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-joy-orange">
              {formatCurrency(currentPrice, currency)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-joy-gray-400 line-through ml-2">
                {formatCurrency(product.comparePrice!, currency)}
              </span>
            )}
          </div>
          <div className="text-xs text-joy-gray-500">
            Stock: {product.inventory}
          </div>
        </div>

        {/* Quantity Input */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-joy-gray-600 whitespace-nowrap">Qty:</label>
          <div className="flex items-center border-2 border-joy-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => onQuantityChange(product.id, Math.max(product.minOrderQty || 1, quantity - 1))}
              className="px-3 py-1.5 hover:bg-joy-gray-50 text-joy-gray-600"
            >
              <Icons.Minus size={14} />
            </button>
            <input
              type="number"
              value={quantity}
              onChange={handleQtyChange}
              min={product.minOrderQty || 1}
              className="w-16 text-center py-1.5 border-x border-joy-gray-200 text-sm font-medium focus:outline-none"
            />
            <button
              onClick={() => onQuantityChange(product.id, quantity + 1)}
              className="px-3 py-1.5 hover:bg-joy-gray-50 text-joy-gray-600"
            >
              <Icons.Plus size={14} />
            </button>
          </div>
          <span className="text-xs text-joy-gray-400">
            Min: {product.minOrderQty || 1}
          </span>
        </div>

        {/* Subtotal */}
        <div className="flex items-center justify-between pt-2 border-t border-joy-gray-100">
          <span className="text-sm text-joy-gray-600">Subtotal:</span>
          <span className="font-bold text-joy-gray-900">
            {formatCurrency(currentPrice * quantity, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}

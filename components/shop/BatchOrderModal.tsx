'use client'

import { useState } from 'react'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/lib/store'
import type { Product } from '@/types'

interface BatchOrderModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
}

export function BatchOrderModal({ isOpen, onClose, products }: BatchOrderModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addItem } = useCartStore()

  if (!isOpen) return null

  const selectedProducts = products.filter(p => (quantities[p.id] || 0) > 0)
  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0)
  const totalPrice = selectedProducts.reduce((sum, p) => sum + (p.price * (quantities[p.id] || 0)), 0)

  const handleQuantityChange = (productId: string, qty: number) => {
    setQuantities(prev => ({ ...prev, [productId]: Math.max(0, qty) }))
  }

  const handleAddToCart = async () => {
    setIsSubmitting(true)
    for (const product of selectedProducts) {
      const qty = quantities[product.id]
      addItem(product, qty)
    }
    setIsSubmitting(false)
    setQuantities({})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-joy-gray-100">
          <div>
            <h2 className="text-xl font-bold text-joy-gray-900">Batch Order</h2>
            <p className="text-sm text-joy-gray-500">{selectedProducts.length} products selected</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-joy-gray-100 rounded-full transition-colors">
            <Icons.X size={20} className="text-joy-gray-500" />
          </button>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-6">
          {products.length === 0 ? (
            <div className="text-center py-12 text-joy-gray-500">
              <Icons.ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
              <p>No products available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map(product => {
                const images: string[] = product.images ? JSON.parse(product.images) : []
                const qty = quantities[product.id] || 0
                return (
                  <div key={product.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-colors ${qty > 0 ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-100'}`}>
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-joy-gray-100">
                      {images[0] ? (
                        <img src={images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icons.Package size={24} className="text-joy-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-joy-gray-800 truncate">{product.name}</p>
                      <p className="text-sm text-joy-gray-500">SKU: {product.sku}</p>
                      <p className="text-joy-orange font-semibold">${product.price?.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuantityChange(product.id, qty - 1)}
                        className="w-8 h-8 rounded-full bg-joy-gray-100 hover:bg-joy-gray-200 flex items-center justify-center transition-colors"
                      >
                        <Icons.Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={qty || ''}
                        onChange={e => handleQuantityChange(product.id, parseInt(e.target.value) || 0)}
                        className="w-16 h-8 text-center border border-joy-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                      />
                      <button
                        onClick={() => handleQuantityChange(product.id, qty + 1)}
                        className="w-8 h-8 rounded-full bg-joy-gray-100 hover:bg-joy-gray-200 flex items-center justify-center transition-colors"
                      >
                        <Icons.Plus size={14} />
                      </button>
                    </div>
                    {qty > 0 && (
                      <p className="text-sm font-medium text-joy-orange w-20 text-right">
                        ${(product.price * qty).toFixed(2)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedProducts.length > 0 && (
          <div className="border-t border-joy-gray-100 px-6 py-4 bg-joy-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-joy-gray-500">Total ({totalItems} items)</p>
                <p className="text-2xl font-bold text-joy-orange">${totalPrice.toFixed(2)}</p>
              </div>
              <Button onClick={handleAddToCart} isLoading={isSubmitting} size="lg">
                Add to Cart
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

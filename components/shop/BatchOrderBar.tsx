'use client'

import { useRouter } from 'next/navigation'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import type { Currency } from '@/types'

interface BatchOrderItem {
  productId: string
  name: string
  sku: string
  price: number
  quantity: number
  image?: string
}

interface BatchOrderBarProps {
  items: BatchOrderItem[]
  currency?: Currency
  onClear: () => void
  onContinueShopping: () => void
}

export function BatchOrderBar({ items, currency = 'USD', onClear, onContinueShopping }: BatchOrderBarProps) {
  const router = useRouter()
  
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleProceedToCheckout = () => {
    // Store batch order items in localStorage for checkout
    localStorage.setItem('batchOrder', JSON.stringify(items))
    localStorage.setItem('batchOrderTotal', subtotal.toString())
    router.push('/checkout/batch')
  }

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-joy-orange shadow-2xl z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Summary */}
          <div className="flex-1 flex items-center gap-6">
            <div className="flex items-center gap-2 text-joy-gray-600">
              <Icons.ShoppingCart size={20} className="text-joy-orange" />
              <span className="font-medium">{items.length}</span>
              <span className="text-sm">products selected</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-joy-gray-200" />
            <div className="text-sm text-joy-gray-500">
              Total: <span className="font-medium text-joy-gray-700">{totalItems}</span> pcs
            </div>
            <div className="hidden sm:block w-px h-6 bg-joy-gray-200" />
            <div>
              <span className="text-sm text-joy-gray-500">Subtotal:</span>
              <span className="ml-2 text-xl font-bold text-joy-orange">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={onClear}
            >
              Clear
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={onContinueShopping}
            >
              Continue Shopping
            </Button>
            <Button 
              size="lg"
              onClick={handleProceedToCheckout}
              className="bg-joy-orange hover:bg-joy-orange/90"
            >
              <Icons.Check size={18} className="mr-2" />
              Proceed to Checkout ({items.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

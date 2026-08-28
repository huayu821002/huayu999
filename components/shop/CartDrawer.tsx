'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn, formatCurrency, convertPrice } from '@/lib/utils'
import { useCartStore } from '@/lib/store'
import { parseProductImages } from '@/lib/imageUtils'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'

export function CartDrawer() {
  const router = useRouter()
  const { items, isOpen, toggleCart, removeItem, updateQuantity, currency, getSubtotal, getItemCount } = useCartStore()
  const subtotal = getSubtotal()
  const itemCount = getItemCount()

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) toggleCart()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, toggleCart])

  const handleCheckout = () => {
    toggleCart()
    router.push('/checkout')
  }

  const shippingCost = subtotal >= 299 ? 0 : 12.99
  const estimatedTotal = subtotal + shippingCost

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
          onClick={toggleCart}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-joy-gray-100">
          <div className="flex items-center gap-2">
            <Icons.ShoppingCart size={24} className="text-joy-orange" />
            <h2 className="font-display font-bold text-xl">Your Cart</h2>
            {itemCount > 0 && (
              <span className="bg-joy-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {itemCount}
              </span>
            )}
          </div>
          <button
            onClick={toggleCart}
            className="p-2 hover:bg-joy-gray-100 rounded-lg transition-colors"
            aria-label="Close cart"
          >
            <Icons.X size={24} />
          </button>
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[calc(100%-80px)] p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-joy-gray-100 flex items-center justify-center mb-6">
              <Icons.ShoppingCart size={48} className="text-joy-gray-300" />
            </div>
            <h3 className="font-semibold text-joy-gray-900 mb-2">Your cart is empty</h3>
            <p className="text-joy-gray-500 mb-6">Discover amazing products from Fiestaflare Wholesaler!</p>
            <Button onClick={toggleCart} variant="primary">
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 p-3 bg-joy-gray-50 rounded-xl">
                  {/* Product Image */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-white flex-shrink-0">
                    <img
                      src={parseProductImages(item.product.images)[0] || '/placeholder.png'}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-joy-gray-900 truncate">
                      {item.product.name}
                    </h4>
                    {item.variant && (
                      <p className="text-xs text-joy-gray-500 mb-1">
                        {item.variant.name}: {item.variant.value}
                      </p>
                    )}
                    {item.warehouseName && (
                      <p className="text-xs text-joy-blue mb-1">
                        📦 {item.warehouseName}
                      </p>
                    )}
                    <p className="text-sm text-joy-gray-500 mb-2">
                      SKU: {item.product.sku}
                    </p>

                    {/* Price & Quantity */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-joy-orange">
                          {formatCurrency(convertPrice(item.product.price, currency), currency)}
                        </span>
                        {item.product.comparePrice && (
                          <span className="text-xs text-joy-gray-400 line-through">
                            {formatCurrency(convertPrice(item.product.comparePrice, currency), currency)}
                          </span>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-joy-gray-200 flex items-center justify-center hover:border-joy-orange transition-colors"
                        >
                          <Icons.Minus size={14} />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-joy-gray-200 flex items-center justify-center hover:border-joy-orange transition-colors"
                        >
                          <Icons.Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-joy-gray-400 hover:text-red-500 transition-colors self-start"
                    aria-label="Remove item"
                  >
                    <Icons.Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer Summary */}
            <div className="border-t border-joy-gray-100 p-4 space-y-4 bg-white">
              {/* Subtotal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-joy-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-joy-gray-600">
                  <span className="flex items-center gap-1">
                    Shipping
                    {subtotal >= 299 && (
                      <span className="text-xs text-joy-green font-medium">(Free!)</span>
                    )}
                  </span>
                  <span className="font-medium">
                    {shippingCost === 0 ? 'FREE' : formatCurrency(shippingCost, currency)}
                  </span>
                </div>
                {subtotal < 299 && (
                  <p className="text-xs text-joy-orange">
                    Add {formatCurrency(299 - subtotal, currency)} more for free shipping!
                  </p>
                )}
                <div className="flex items-center justify-between text-lg font-bold text-joy-gray-900 pt-2 border-t border-joy-gray-100">
                  <span>Estimated Total</span>
                  <span className="text-joy-orange">{formatCurrency(estimatedTotal, currency)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={handleCheckout}
                  className="w-full"
                  size="lg"
                >
                  Proceed to Checkout
                </Button>
                <Button
                  onClick={toggleCart}
                  variant="secondary"
                  className="w-full"
                >
                  Continue Shopping
                </Button>
              </div>

              {/* Trust Signals */}
              <div className="flex items-center justify-center gap-4 pt-2 text-xs text-joy-gray-500">
                <span className="flex items-center gap-1">
                  <Icons.ShieldCheck size={14} className="text-joy-green" />
                  Secure Checkout
                </span>
                <span className="flex items-center gap-1">
                  <Icons.RefreshCw size={14} className="text-joy-orange" />
                  30-Day Returns
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

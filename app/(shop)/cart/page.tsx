'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { cn, formatCurrency, convertPrice } from '@/lib/utils'
import { useCartStore } from '@/lib/store'
import { parseProductImages } from '@/lib/imageUtils'
import type { Currency } from '@/types'

export default function CartPage() {
  const router = useRouter()
  const { items, currency, updateQuantity, removeItem, clearCart, getSubtotal, setCurrency } = useCartStore()
  const subtotal = getSubtotal()

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-joy-gray-50">
        <Header />
        <main className="pt-[calc(4rem+36px)]">
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-joy-gray-100 flex items-center justify-center mx-auto mb-4">
              <Icons.ShoppingCart size={40} className="text-joy-gray-300" />
            </div>
            <h1 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">Your cart is empty</h1>
            <p className="text-joy-gray-600 mb-6">Add some products to get started</p>
            <Link href="/products"><Button>Browse Products</Button></Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Shopping Cart</h1>
              <p className="text-joy-gray-500 mt-1">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={clearCart}>
              <Icons.Trash2 size={16} className="mr-1" />
              Clear Cart
            </Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-joy-gray-100">
                {items.map((item) => {
                  const images = parseProductImages(item.product.images)
                  const itemPrice = convertPrice(item.product.price * item.quantity, currency)
                  return (
                    <div key={item.id} className="p-4 sm:p-6 flex gap-4">
                      {/* Product Image */}
                      <Link href={`/products/${item.product.slug}`} className="flex-shrink-0">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-joy-gray-100">
                          <img
                            src={images[0] || '/placeholder.png'}
                            alt={item.product.name}
                            className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                          />
                        </div>
                      </Link>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link href={`/products/${item.product.slug}`} className="font-medium text-joy-gray-900 hover:text-joy-orange transition-colors line-clamp-1">
                              {item.product.name}
                            </Link>
                            <p className="text-sm text-joy-gray-500 mt-0.5">SKU: {item.product.sku || 'N/A'}</p>
                            {item.variant && (
                              <p className="text-sm text-joy-gray-500">{item.variant.name}: {item.variant.value}</p>
                            )}
                            {item.warehouseName && (
                              <p className="text-xs text-joy-gray-400 mt-1">Warehouse: {item.warehouseName}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-joy-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          >
                            <Icons.Trash2 size={18} />
                          </button>
                        </div>

                        {/* Price & Quantity */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 rounded-lg border border-joy-gray-200 flex items-center justify-center hover:bg-joy-gray-50 transition-colors"
                            >
                              <Icons.Minus size={14} />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1
                                updateQuantity(item.id, Math.max(1, val))
                              }}
                              min={1}
                              className="w-14 h-8 rounded-lg border border-joy-gray-200 text-center text-sm font-medium focus:outline-none focus:border-joy-orange"
                            />
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 rounded-lg border border-joy-gray-200 flex items-center justify-center hover:bg-joy-gray-50 transition-colors"
                            >
                              <Icons.Plus size={14} />
                            </button>
                          </div>
                          <span className="font-semibold text-joy-orange text-lg">
                            {formatCurrency(itemPrice, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Continue Shopping */}
              <div className="mt-4">
                <Link href="/products" className="text-sm text-joy-orange hover:underline flex items-center gap-1">
                  <Icons.ChevronLeft size={16} />
                  Continue Shopping
                </Link>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-40">
                <h3 className="font-semibold text-lg text-joy-gray-900 mb-4">Order Summary</h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-joy-gray-600">Subtotal ({items.reduce((acc, i) => acc + i.quantity, 0)} items)</span>
                    <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-joy-gray-600">Shipping</span>
                    <span className="text-joy-gray-500 text-xs">Calculated at checkout</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-joy-gray-600">Tax</span>
                    <span className="text-joy-gray-500 text-xs">Calculated at checkout</span>
                  </div>
                </div>

                <div className="border-t border-joy-gray-100 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-joy-gray-900">Estimated Total</span>
                    <span className="text-2xl font-bold text-joy-orange">
                      {formatCurrency(subtotal, currency)}
                    </span>
                  </div>
                </div>

                <Button onClick={() => router.push('/checkout')} className="w-full" size="lg">
                  Proceed to Checkout
                  <Icons.ChevronRight size={18} className="ml-1" />
                </Button>

                {/* Currency Selector */}
                <div className="mt-6 pt-6 border-t border-joy-gray-100">
                  <label className="block text-sm font-medium text-joy-gray-700 mb-2">Display Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-joy-gray-200 text-sm focus:border-joy-orange focus:outline-none"
                  >
                    <option value="USD">$ USD</option>
                    <option value="MXN">MX$ MXN</option>
                    <option value="BRL">R$ BRL</option>
                  </select>
                </div>

                {/* Trust Signals */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-joy-gray-500">
                    <Icons.Lock size={16} className="text-joy-green" />
                    Secure checkout
                  </div>
                  <div className="flex items-center gap-2 text-sm text-joy-gray-500">
                    <Icons.RefreshCw size={16} className="text-joy-green" />
                    30-day returns
                  </div>
                  <div className="flex items-center gap-2 text-sm text-joy-gray-500">
                    <Icons.Headphones size={16} className="text-joy-green" />
                    24/7 support
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

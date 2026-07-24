'use client'

import { useState } from 'react'
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
import type { Currency } from '@/types'

const STEPS = ['Cart', 'Shipping', 'Payment', 'Confirm']

interface ShippingForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  country: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, currency, getSubtotal, clearCart } = useCartStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [error, setError] = useState('')

  const [shippingForm, setShippingForm] = useState<ShippingForm>({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'United States'
  })

  const subtotal = getSubtotal()
  const shippingCost = subtotal >= 299 ? 0 : 12.99
  const tax = subtotal * 0.08
  const total = subtotal + shippingCost + tax

  const updateShipping = (field: keyof ShippingForm, value: string) => {
    setShippingForm(prev => ({ ...prev, [field]: value }))
  }

  const handlePlaceOrder = async () => {
    setIsProcessing(true)
    setError('')

    try {
      // Get user from localStorage
      const userStr = localStorage.getItem('user')
      const user = userStr ? JSON.parse(userStr) : null
      const userId = user?.id || 'guest'

      // Build shipping address string
      const shippingAddress = `${shippingForm.firstName} ${shippingForm.lastName}, ${shippingForm.address}, ${shippingForm.city}, ${shippingForm.state} ${shippingForm.zip}, ${shippingForm.country}`

      // Prepare items for API
      const orderItems = items.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        price: item.product.price,
        quantity: item.quantity,
        variant: item.variant ? `${item.variant.name}: ${item.variant.value}` : null,
      }))

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          items: orderItems,
          subtotal,
          shippingCost,
          tax,
          discount: 0,
          total,
          currency,
          shippingAddress,
          paymentMethod: 'CARD',
        }),
      })

      const data = await res.json()

      if (data.success) {
        setOrderNumber(data.data.orderNumber)
        clearCart()
        setCurrentStep(4)
      } else {
        setError(data.error || 'Failed to place order')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (items.length === 0 && currentStep < 4) {
    return (
      <div className="min-h-screen bg-joy-gray-50">
        <Header />
        <main className="pt-[calc(4rem+36px)]">
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-joy-gray-100 flex items-center justify-center mx-auto mb-4">
              <Icons.ShoppingCart size={40} className="text-joy-gray-300" />
            </div>
            <h1 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">Your cart is empty</h1>
            <p className="text-joy-gray-600 mb-6">Add some products to checkout</p>
            <Link href="/products"><Button>Browse Products</Button></Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />

      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-4">
              {STEPS.map((step, i) => (
                <div key={step} className="flex items-center">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors',
                    i + 1 <= currentStep ? 'bg-joy-orange text-white' : 'bg-joy-gray-200 text-joy-gray-500'
                  )}>
                    {i + 1 < currentStep ? <Icons.Check size={18} /> : i + 1}
                  </div>
                  <span className={cn('ml-2 font-medium hidden sm:inline', i + 1 <= currentStep ? 'text-joy-gray-900' : 'text-joy-gray-400')}>
                    {step}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className={cn('w-12 lg:w-20 h-0.5 mx-4', i + 1 < currentStep ? 'bg-joy-orange' : 'bg-joy-gray-200')} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {currentStep === 1 && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="font-semibold text-xl text-joy-gray-900 mb-4">Review Your Cart</h2>
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-4 p-4 bg-joy-gray-50 rounded-xl">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-white">
                          <img src={item.product.images[0] || '/placeholder.png'} alt={item.product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-joy-gray-900">{item.product.name}</h3>
                          <p className="text-sm text-joy-gray-500">SKU: {item.product.sku}</p>
                          {item.variant && <p className="text-sm text-joy-gray-500">{item.variant.name}: {item.variant.value}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-joy-gray-500">Qty: {item.quantity}</span>
                            <span className="font-semibold text-joy-orange">{formatCurrency(convertPrice(item.product.price * item.quantity, currency), currency)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => setCurrentStep(2)} className="w-full mt-6" size="lg">
                    Continue to Shipping <Icons.ChevronRight size={18} className="ml-1" />
                  </Button>
                </div>
              )}

              {currentStep === 2 && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="font-semibold text-xl text-joy-gray-900 mb-6">Shipping Information</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="First Name *" placeholder="John" value={shippingForm.firstName} onChange={e => updateShipping('firstName', e.target.value)} />
                      <Input label="Last Name *" placeholder="Smith" value={shippingForm.lastName} onChange={e => updateShipping('lastName', e.target.value)} />
                    </div>
                    <Input label="Email *" type="email" placeholder="john@example.com" value={shippingForm.email} onChange={e => updateShipping('email', e.target.value)} />
                    <Input label="Phone *" type="tel" placeholder="+1 (555) 000-0000" value={shippingForm.phone} onChange={e => updateShipping('phone', e.target.value)} />
                    <Input label="Address *" placeholder="123 Main St" value={shippingForm.address} onChange={e => updateShipping('address', e.target.value)} />
                    <div className="grid grid-cols-3 gap-4">
                      <Input label="City *" placeholder="New York" value={shippingForm.city} onChange={e => updateShipping('city', e.target.value)} />
                      <Input label="State *" placeholder="NY" value={shippingForm.state} onChange={e => updateShipping('state', e.target.value)} />
                      <Input label="ZIP *" placeholder="10001" value={shippingForm.zip} onChange={e => updateShipping('zip', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-2">Country *</label>
                      <select className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none" value={shippingForm.country} onChange={e => updateShipping('country', e.target.value)}>
                        <option>United States</option>
                        <option>Canada</option>
                        <option>Mexico</option>
                        <option>Brazil</option>
                        <option>Argentina</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-6">
                    <Button variant="secondary" onClick={() => setCurrentStep(1)}>Back</Button>
                    <Button onClick={() => setCurrentStep(3)} className="flex-1" size="lg">
                      Continue to Payment <Icons.ChevronRight size={18} className="ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="font-semibold text-xl text-joy-gray-900 mb-6">Payment Method</h2>
                  <div className="space-y-4 mb-6">
                    <label className="flex items-center gap-4 p-4 border-2 border-joy-orange rounded-xl cursor-pointer bg-joy-orange/5">
                      <input type="radio" name="payment" defaultChecked className="accent-joy-orange" />
                      <Icons.CreditCard size={24} className="text-joy-gray-600" />
                      <span className="font-medium">Credit / Debit Card</span>
                    </label>
                    <label className="flex items-center gap-4 p-4 border-2 border-joy-gray-200 rounded-xl cursor-pointer hover:border-joy-orange transition-colors">
                      <input type="radio" name="payment" className="accent-joy-orange" />
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h12.004c.524 0 .972.382 1.054.901l3.107 19.696a.641.641 0 0 1-.633.74h-4.606a.75.75 0 0 1-.612-.314l-1.937-2.754-1.937 2.754a.75.75 0 0 1-.612.314H7.076z"/></svg>
                      <span className="font-medium">PayPal</span>
                    </label>
                  </div>
                  <div className="space-y-4 border-t border-joy-gray-100 pt-6">
                    <Input label="Card Number" placeholder="4242 4242 4242 4242" />
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Expiry Date" placeholder="MM/YY" />
                      <Input label="CVC" placeholder="123" />
                    </div>
                    <Input label="Name on Card" placeholder="John Smith" />
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-sm text-joy-gray-500">
                    <Icons.Lock size={16} />
                    <span>Your payment information is encrypted and secure</span>
                  </div>
                  {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                  <div className="flex gap-4 mt-6">
                    <Button variant="secondary" onClick={() => setCurrentStep(2)}>Back</Button>
                    <Button onClick={handlePlaceOrder} className="flex-1" size="lg" isLoading={isProcessing}>
                      {isProcessing ? 'Processing...' : `Pay ${formatCurrency(total, currency)}`}
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-joy-green/10 flex items-center justify-center mx-auto mb-4">
                    <Icons.Check size={40} className="text-joy-green" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">Order Placed!</h2>
                  <p className="text-joy-gray-600 mb-6">Thank you for your order. We'll send you a confirmation email shortly.</p>
                  {orderNumber && (
                    <p className="font-mono text-lg bg-joy-gray-50 rounded-lg py-3 px-4 inline-block mb-6">
                      Order #{orderNumber}
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/account/orders"><Button variant="secondary">View Order</Button></Link>
                    <Link href="/products"><Button>Continue Shopping</Button></Link>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-40">
                <h3 className="font-semibold text-lg text-joy-gray-900 mb-4">Order Summary</h3>
                <div className="space-y-3 mb-6">
                  {items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-joy-gray-100 flex-shrink-0">
                        <img src={item.product.images[0] || '/placeholder.png'} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-joy-gray-900 truncate">{item.product.name}</p>
                        <p className="text-xs text-joy-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-joy-gray-900">{formatCurrency(convertPrice(item.product.price * item.quantity, currency), currency)}</p>
                    </div>
                  ))}
                  {items.length > 3 && <p className="text-sm text-joy-gray-500 text-center">+ {items.length - 3} more items</p>}
                </div>
                <div className="border-t border-joy-gray-100 pt-4 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-joy-gray-600">Subtotal</span><span className="font-medium">{formatCurrency(subtotal, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-joy-gray-600">Shipping</span><span className="font-medium">{shippingCost === 0 ? <span className="text-joy-green">FREE</span> : formatCurrency(shippingCost, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-joy-gray-600">Tax (8%)</span><span className="font-medium">{formatCurrency(tax, currency)}</span></div>
                  <div className="flex justify-between text-lg font-bold pt-3 border-t border-joy-gray-100"><span>Total</span><span className="text-joy-orange">{formatCurrency(total, currency)}</span></div>
                </div>
                <div className="mt-6">
                  <label className="block text-sm font-medium text-joy-gray-700 mb-2">Display Currency</label>
                  <select value={currency} onChange={e => useCartStore.getState().setCurrency(e.target.value as Currency)} className="w-full px-4 py-2.5 rounded-xl border-2 border-joy-gray-200 text-sm focus:border-joy-orange focus:outline-none">
                    <option value="USD">$ USD - US Dollar</option>
                    <option value="MXN">MX$ MXN - Mexican Peso</option>
                    <option value="BRL">R$ BRL - Brazilian Real</option>
                  </select>
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

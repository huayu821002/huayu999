'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { cn, formatCurrency } from '@/lib/utils'
import { useCartStore } from '@/lib/store'

interface BatchOrderItem {
  productId: string
  name: string
  sku: string
  price: number
  quantity: number
  image?: string
}

export default function BatchCheckoutPage() {
  const router = useRouter()
  const { currency } = useCartStore()
  const [items, setItems] = useState<BatchOrderItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  
  // Customer info
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    notes: '',
  })

  useEffect(() => {
    const stored = localStorage.getItem('batchOrder')
    if (stored) {
      setItems(JSON.parse(stored))
    } else {
      router.push('/products')
    }
  }, [router])

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = subtotal > 500 ? 0 : 29.99
  const total = subtotal + shipping

  const handleSubmitOrder = async () => {
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      alert('Please fill in required fields: Name, Email, Phone')
      return
    }

    setIsSubmitting(true)
    
    try {
      // Format customer info as shipping address string
      const shippingAddress = JSON.stringify({
        name: customerInfo.name,
        email: customerInfo.email,
        phone: customerInfo.phone,
        company: customerInfo.company,
        address: customerInfo.address,
        city: customerInfo.city,
        state: customerInfo.state,
        zip: customerInfo.zip,
        country: customerInfo.country,
        notes: customerInfo.notes,
      })

      const orderData = {
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal,
        shippingCost: shipping,
        total,
        shippingAddress,
        currency: 'USD',
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })

      const data = await res.json()
      
      if (data.success) {
        setOrderNumber(data.data?.orderNumber || `BO-${Date.now()}`)
        setOrderSuccess(true)
        localStorage.removeItem('batchOrder')
        localStorage.removeItem('batchOrderTotal')
      } else {
        alert(data.error || 'Failed to submit order')
      }
    } catch (err) {
      console.error('Order submission error:', err)
      alert('Failed to submit order. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-joy-gray-50">
        <Header />
        <main className="pt-[calc(4rem+36px)]">
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <div className="w-20 h-20 bg-joy-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icons.Check size={40} className="text-joy-green" />
            </div>
            <h1 className="text-3xl font-bold text-joy-gray-900 mb-4">Order Submitted!</h1>
            <p className="text-lg text-joy-gray-600 mb-2">
              Thank you for your batch order. We will process it shortly.
            </p>
            <p className="text-joy-gray-500 mb-8">
              Order Number: <span className="font-mono font-bold">{orderNumber}</span>
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/products">
                <Button>Continue Shopping</Button>
              </Link>
              <Link href="/">
                <Button variant="secondary">Back to Home</Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-joy-gray-50">
        <Header />
        <main className="pt-[calc(4rem+36px)]">
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <Icons.ShoppingCart size={64} className="mx-auto mb-4 text-joy-gray-300" />
            <h1 className="text-2xl font-bold text-joy-gray-900 mb-4">No Items Selected</h1>
            <p className="text-joy-gray-500 mb-8">Please select products to order.</p>
            <Link href="/products">
              <Button>Browse Products</Button>
            </Link>
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
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-joy-gray-900 mb-2">Batch Order Checkout</h1>
          <p className="text-joy-gray-600 mb-8">Review your order and submit</p>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Order Items */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Order Items ({items.length})</h2>
                
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-4 p-4 bg-joy-gray-50 rounded-xl">
                      <div className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-joy-gray-300">
                            <Icons.Package size={24} />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-joy-gray-900 line-clamp-1">{item.name}</h3>
                        <p className="text-sm text-joy-gray-400">SKU: {item.sku || 'N/A'}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-joy-gray-600">
                            {formatCurrency(item.price, currency)} × {item.quantity}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="font-bold text-joy-gray-900">
                          {formatCurrency(item.price * item.quantity, currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Customer Information</h2>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input 
                    label="Name *"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    placeholder="Your full name"
                  />
                  <Input 
                    label="Email *"
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                    placeholder="your@email.com"
                  />
                  <Input 
                    label="Phone *"
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                  <Input 
                    label="Company"
                    value={customerInfo.company}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, company: e.target.value })}
                    placeholder="Company name (optional)"
                  />
                  <Input 
                    label="Address *"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                    placeholder="Street address"
                    className="sm:col-span-2"
                  />
                  <Input 
                    label="City *"
                    value={customerInfo.city}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })}
                  />
                  <Input 
                    label="State/Province"
                    value={customerInfo.state}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, state: e.target.value })}
                  />
                  <Input 
                    label="ZIP/Postal Code"
                    value={customerInfo.zip}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, zip: e.target.value })}
                  />
                  <Input 
                    label="Country"
                    value={customerInfo.country}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, country: e.target.value })}
                  />
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Order Notes</label>
                    <textarea
                      value={customerInfo.notes}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                      placeholder="Special instructions or notes..."
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-32">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Order Summary</h2>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-joy-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-joy-gray-600">Shipping</span>
                    <span className="font-medium">
                      {shipping === 0 ? 'FREE' : formatCurrency(shipping, currency)}
                    </span>
                  </div>
                  {shipping > 0 && (
                    <p className="text-xs text-joy-green">Free shipping on orders over $500</p>
                  )}
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold text-joy-gray-900">Total</span>
                    <span className="font-bold text-xl text-joy-orange">{formatCurrency(total, currency)}</span>
                  </div>
                </div>

                <Button 
                  onClick={handleSubmitOrder}
                  isLoading={isSubmitting}
                  className="w-full mt-6 bg-joy-orange hover:bg-joy-orange/90"
                  size="lg"
                >
                  <Icons.Check size={18} className="mr-2" />
                  Submit Order
                </Button>

                <p className="text-xs text-joy-gray-500 text-center mt-4">
                  By submitting, you agree to our terms of service
                </p>

                <div className="mt-6 pt-6 border-t">
                  <Link href="/products" className="text-sm text-joy-orange hover:underline flex items-center justify-center gap-1">
                    <Icons.ChevronLeft size={14} />
                    Continue Shopping
                  </Link>
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { cn, formatCurrency } from '@/lib/utils'
import { useCartStore } from '@/lib/store'
import { AddressSelect } from '@/components/shop/AddressSelect'
import { ShippingSelect } from '@/components/shop/ShippingSelect'
import { ShippingOption } from '@/lib/shipping'

interface BatchOrderItem {
  productId: string
  name: string
  sku: string
  price: number
  quantity: number
  weight?: number | null
  image?: string
}

interface AddressData {
  country: string
  state: string
  city: string
  street: string
  zip: string
}

export default function BatchCheckoutPage() {
  const router = useRouter()
  const { currency } = useCartStore()
  const [items, setItems] = useState<BatchOrderItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [error, setError] = useState('')
  
  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'PAYPAL' | 'STRIPE' | 'BANK_TRANSFER'>('PAYPAL')
  const [paypalClientId, setPaypalClientId] = useState<string>('')
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  
  // Customer info
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  })
  
  // Address with cascading dropdowns
  const [address, setAddress] = useState<AddressData>({
    country: '',
    state: '',
    city: '',
    street: '',
    zip: '',
  })
  
  // Shipping
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('batchOrder')
    if (stored) {
      try {
        setItems(JSON.parse(stored))
      } catch {
        router.push('/products')
      }
    } else {
      router.push('/products')
    }
  }, [router])

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shippingCost = selectedShipping?.cost ?? 0
  const total = subtotal + shippingCost

  // Fetch payment settings
  useEffect(() => {
    const fetchPaymentSettings = async () => {
      try {
        const res = await fetch('/api/site/payment-settings')
        const data = await res.json()
        if (data.success && data.data.paypal?.clientId) {
          setPaypalClientId(data.data.paypal.clientId)
        }
      } catch (err) { console.error(err) }
    }
    fetchPaymentSettings()
  }, [])

  // Preload PayPal SDK
  useEffect(() => {
    if (!paypalClientId || (window as any).paypal) return
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=${currency}`
    script.async = true
    script.onload = () => setPaypalLoaded(true)
    document.body.appendChild(script)
  }, [paypalClientId, currency])

  // Render PayPal buttons when selected
  useEffect(() => {
    if (paymentMethod !== 'PAYPAL') return
    
    // Wait for SDK to be loaded and container to be mounted
    const tryRender = () => {
      const containerEl = document.getElementById('paypal-button-container-batch') as HTMLDivElement | null
      if (!containerEl || !paypalClientId) {
        // Retry after a short delay if conditions not met
        setTimeout(tryRender, 100)
        return
      }
      containerEl.innerHTML = ''

      const paypal = (window as any).paypal
      if (paypal) {
      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
        createOrder: (_data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [{ amount: { value: total.toFixed(2) } }]
          })
        },
        onApprove: async (_data: any, actions: any) => {
          setIsSubmitting(true)
          try {
            const details = await actions.order.capture()
            await handlePlaceOrderWithPayPal(details)
          } catch (err) {
            setError('Payment capture failed. Please try again.')
            setIsSubmitting(false)
          }
        },
        onError: (err: any) => {
          console.error('PayPal error:', err)
          setError('PayPal payment failed. Please try again.')
        }
      }).render(containerEl)
    }
    
    // Initial try
    tryRender()
  }
  }, [paymentMethod, paypalClientId, total, paypalLoaded])

  const handlePlaceOrderWithPayPal = async (paypalDetails: any) => {
    try {
      const shippingAddress = JSON.stringify({
        name: customerInfo.name,
        email: customerInfo.email,
        phone: customerInfo.phone,
        company: customerInfo.company,
        street: address.street,
        city: address.city,
        state: address.state,
        country: address.country,
        zip: address.zip,
      })

      const orderItems = items.map(item => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        image: item.image || null,
      }))

      const orderData = {
        items: orderItems,
        subtotal,
        shippingCost,
        total,
        shippingAddress,
        currency: 'USD',
        shippingMethod: selectedShipping?.name || 'Standard',
        paymentMethod: 'PAYPAL',
        paypalOrderId: paypalDetails.id,
        paypalStatus: paypalDetails.status,
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
        setError(data.error || 'Failed to submit order')
      }
    } catch (err) {
      console.error('Order error:', err)
      setError('Failed to submit order. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitOrder = async () => {
    // Validation
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      alert('Please fill in: Name, Email, Phone')
      return
    }
    if (!address.country || !address.state || !address.city || !address.street) {
      alert('Please complete your shipping address')
      return
    }
    if (!selectedShipping) {
      alert('Please select a shipping method')
      return
    }

    setIsSubmitting(true)
    
    try {
      // Format shipping address
      const shippingAddress = JSON.stringify({
        name: customerInfo.name,
        email: customerInfo.email,
        phone: customerInfo.phone,
        company: customerInfo.company,
        street: address.street,
        city: address.city,
        state: address.state,
        country: address.country,
        zip: address.zip,
      })

      // Include full product details in order items
      const orderItems = items.map(item => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        image: item.image || null,
      }))

      const orderData = {
        items: orderItems,
        subtotal,
        shippingCost,
        total,
        shippingAddress,
        currency: 'USD',
        shippingMethod: selectedShipping?.name || 'Standard',
        paymentMethod,
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
            {/* Left Column - Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Items */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">
                  Order Items ({items.length})
                </h2>
                
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-4 p-4 bg-joy-gray-50 rounded-xl">
                      <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0">
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
                        <p className="text-sm text-joy-gray-600 mt-1">
                          {formatCurrency(item.price, currency)} × {item.quantity} pcs
                          {item.weight && <span className="text-joy-gray-400 ml-2">| Weight: {item.weight}kg</span>}
                        </p>
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

              {/* Contact Info */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Contact Information</h2>
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
                </div>
              </div>

              {/* Shipping Address with Cascading Dropdowns */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Shipping Address</h2>
                <AddressSelect value={address} onChange={setAddress} />
              </div>

              {/* Shipping Method */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Shipping Method</h2>
                <ShippingSelect
                  items={items}
                  subtotal={subtotal}
                  country={address.country}
                  value={selectedShipping?.id || ''}
                  onChange={setSelectedShipping}
                />
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-32">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Order Summary</h2>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-joy-gray-600">Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                    <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-joy-gray-600">Shipping</span>
                    <span className="font-medium">
                      {selectedShipping?.isFree ? (
                        <span className="text-joy-green">FREE</span>
                      ) : (
                        formatCurrency(shippingCost, currency)
                      )}
                    </span>
                  </div>
                  {selectedShipping?.isFree && (
                    <div className="text-xs text-joy-green">Free shipping applied!</div>
                  )}
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold text-joy-gray-900">Total</span>
                    <span className="font-bold text-xl text-joy-orange">{formatCurrency(total, currency)}</span>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div className="mt-6 pt-4 border-t">
                  <h3 className="font-semibold text-joy-gray-900 mb-3">Payment Method</h3>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'PAYPAL' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-gray-300'}`}>
                      <input type="radio" name="payment" checked={paymentMethod === 'PAYPAL'} onChange={() => setPaymentMethod('PAYPAL')} className="accent-joy-orange" />
                      <span className="font-medium">PayPal</span>
                    </label>
                    <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'STRIPE' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-gray-300'}`}>
                      <input type="radio" name="payment" checked={paymentMethod === 'STRIPE'} onChange={() => setPaymentMethod('STRIPE')} className="accent-joy-orange" />
                      <span className="font-medium">Credit Card (Stripe)</span>
                    </label>
                    <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'BANK_TRANSFER' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-gray-300'}`}>
                      <input type="radio" name="payment" checked={paymentMethod === 'BANK_TRANSFER'} onChange={() => setPaymentMethod('BANK_TRANSFER')} className="accent-joy-orange" />
                      <span className="font-medium">Bank Transfer</span>
                    </label>
                  </div>

                  {/* PayPal Button Container */}
                  {paymentMethod === 'PAYPAL' && (
                    <div id="paypal-button-container-batch" className="mt-4" />
                  )}
                </div>

                {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

                {paymentMethod !== 'PAYPAL' && (
                  <Button
                    onClick={handleSubmitOrder}
                    isLoading={isSubmitting}
                    className="w-full mt-4 bg-joy-orange hover:bg-joy-orange/90"
                    size="lg"
                  >
                    <Icons.Check size={18} className="mr-2" />
                    {paymentMethod === 'BANK_TRANSFER' ? 'Submit Order (Bank Transfer)' : `Pay ${formatCurrency(total, currency)}`}
                  </Button>
                )}

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

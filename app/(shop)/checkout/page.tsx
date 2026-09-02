'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { cn, formatCurrency, convertPrice } from '@/lib/utils'
import { useCartStore, useUserStore } from '@/lib/store'
import type { SavedAddress } from '@/lib/store'
import { parseProductImages } from '@/lib/imageUtils'
import { countries } from '@/lib/countries'
import type { Currency } from '@/types'

const STEPS = ['Cart', 'Shipping', 'Payment', 'Confirm']

interface ShippingForm {
  firstName: string; lastName: string; email: string; phone: string
  address: string; city: string; state: string; zip: string; country: string
}

interface ShippingOption {
  id: string; name: string; code: string; description: string | null
  estimatedDays: string | null; cost: number; freeShipping: boolean; available: boolean
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, currency, getSubtotal, getTotalWeight, clearCart } = useCartStore()
  // Read saved addresses from localStorage directly for reliability
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [hasSavedAuth, setHasSavedAuth] = useState(false)
  useEffect(() => {
    const readAddresses = () => {
      const raw = localStorage.getItem('joyhub-user')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          // Zustand persist may wrap in { state: {...}, version: ... } or store flat
          const state = parsed.state ?? parsed
          setSavedAddresses(state.addresses || [])
          setHasSavedAuth(!!state.isAuthenticated)
        } catch { setSavedAddresses([]); setHasSavedAuth(false) }
      } else { setSavedAddresses([]) }
    }
    readAddresses()
    const interval = setInterval(readAddresses, 500)
    return () => clearInterval(interval)
  }, [])
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [error, setError] = useState('')
  const [shippingErrors, setShippingErrors] = useState<Record<string, string>>({})
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [selectedShipping, setSelectedShipping] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'STRIPE' | 'PAYPAL' | 'BANK_TRANSFER'>('STRIPE')
  const [paypalClientId, setPaypalClientId] = useState<string>('')
  const [paypalLoaded, setPaypalLoaded] = useState(false)

  const [shippingForm, setShippingForm] = useState<ShippingForm>({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'United States'
  })

  const subtotal = getSubtotal()
  const totalWeight = getTotalWeight()

  useEffect(() => {
    if (items.length > 0 && subtotal > 0) {
      fetchShippingRates()
    }
    fetchPaymentSettings()
  }, [subtotal, totalWeight, shippingForm.country])

  // Preload PayPal SDK in background when clientId is available
  useEffect(() => {
    if (!paypalClientId) return
    // Check if already loaded
    if ((window as any).paypal) {
      setPaypalLoaded(true)
      return
    }
    // Preload the SDK script
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=${currency}`
    script.async = true
    script.onload = () => setPaypalLoaded(true)
    document.body.appendChild(script)
  }, [paypalClientId, currency])


  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch('/api/site/payment-settings')
      const data = await res.json()
      if (data.success && data.data.paypal?.clientId) {
        setPaypalClientId(data.data.paypal.clientId)
      }
    } catch (err) { console.error(err) }
  }

  const fetchShippingRates = async () => {
    if (!shippingForm.country) {
      // No country selected yet, clear options
      setShippingOptions([])
      setSelectedShipping('')
      return
    }
    // Get warehouseId from first cart item (all items should ideally use the same warehouse)
    const firstItemWithWarehouse = items.find(item => (item as any).warehouseId)
    const warehouseId = firstItemWithWarehouse ? (firstItemWithWarehouse as any).warehouseId : undefined
    try {
      const res = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtotal, weight: totalWeight, country: shippingForm.country, warehouseId }),
      })
      const data = await res.json()
      if (data.success && data.data && data.data.length > 0) {
        setShippingOptions(data.data)
        // Auto-select first available
        const first = data.data.find((o: ShippingOption) => o.available)
        if (first) setSelectedShipping(first.id)
      } else {
        // No shipping methods configured for this country
        setShippingOptions([])
        setSelectedShipping('')
      }
    } catch (err) {
      console.error('Failed to fetch shipping rates:', err)
      setShippingOptions([])
      setSelectedShipping('')
    }
  }

  const selectedOption = shippingOptions.find(o => o.id === selectedShipping)
  const shippingCost = selectedOption?.cost || 0
  const tax = subtotal * 0.08
  const total = subtotal + shippingCost + tax

  // Load PayPal SDK and render buttons when PAYPAL is selected
  useEffect(() => {
    if (paymentMethod !== 'PAYPAL' || !paypalClientId) return

    const containerEl = document.getElementById('paypal-button-container') as HTMLDivElement | null
    if (!containerEl) return
    containerEl.innerHTML = ''

    // Check if PayPal SDK is already loaded (from preload)
    const paypal = (window as any).paypal
    if (paypal && containerEl) {
      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
        createOrder: (_data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [{ amount: { value: total.toFixed(2) } }]
          })
        },
        onApprove: async (_data: any, actions: any) => {
          setIsProcessing(true)
          try {
            const details = await actions.order.capture()
            await handlePlaceOrderWithPayPal(details)
          } catch (err) {
            setError('Payment capture failed. Please try again.')
            setIsProcessing(false)
          }
        },
        onError: (err: any) => {
          console.error('PayPal error:', err)
          setError('PayPal payment failed. Please try again.')
        }
      }).render(containerEl)
      return
    }

    // Fallback: load SDK if not preloaded
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=${currency}`
    script.async = true
    script.onload = () => {
      const paypalLoaded = (window as any).paypal
      if (!paypalLoaded || !containerEl) return
      setPaypalLoaded(true)
      paypalLoaded.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
        createOrder: (_data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [{ amount: { value: total.toFixed(2) } }]
          })
        },
        onApprove: async (_data: any, actions: any) => {
          setIsProcessing(true)
          try {
            const details = await actions.order.capture()
            await handlePlaceOrderWithPayPal(details)
          } catch (err) {
            setError('Payment capture failed. Please try again.')
            setIsProcessing(false)
          }
        },
        onError: (err: any) => {
          console.error('PayPal error:', err)
          setError('PayPal payment failed. Please try again.')
        }
      }).render(containerEl)
    }
    document.body.appendChild(script)
  }, [paymentMethod, paypalClientId, total, currency])

  // Reset paypalLoaded when switching away from PayPal
  useEffect(() => {
    if (paymentMethod !== 'PAYPAL') setPaypalLoaded(false)
  }, [paymentMethod])

  const updateShipping = (field: keyof ShippingForm, value: string) => {
    setShippingForm(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (shippingErrors[field]) {
      setShippingErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateShippingForm = () => {
    const errors: Record<string, string> = {}
    
    if (!shippingForm.firstName.trim()) errors.firstName = 'First name is required'
    if (!shippingForm.lastName.trim()) errors.lastName = 'Last name is required'
    if (!shippingForm.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingForm.email)) {
      errors.email = 'Please enter a valid email address'
    }
    if (!shippingForm.phone.trim()) {
      errors.phone = 'Phone number is required'
    } else if (!/^[\d\s\-\+\(\)]+$/.test(shippingForm.phone) || shippingForm.phone.replace(/\D/g, '').length < 8) {
      errors.phone = 'Please enter a valid phone number'
    }
    if (!shippingForm.address.trim()) errors.address = 'Address is required'
    if (!shippingForm.city.trim()) errors.city = 'City is required'
    if (!shippingForm.state.trim()) errors.state = 'State/Province is required'
    if (!shippingForm.zip.trim()) {
      errors.zip = 'ZIP/Postal code is required'
    } else if (!/^[\d\s\-a-zA-Z]+$/.test(shippingForm.zip)) {
      errors.zip = 'Please enter a valid ZIP/Postal code'
    }
    if (!shippingForm.country) errors.country = 'Please select a country'
    if (shippingOptions.length === 0) {
      alert('Unable to deliver to this address. Please use a different address.')
      return false
    }
    
    setShippingErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePlaceOrder = async () => {
    setIsProcessing(true)
    setError('')
    try {
      const userStr = localStorage.getItem('user')
      const user = userStr ? JSON.parse(userStr) : null
      const userId = user?.id || null

      const shippingAddress = `${shippingForm.firstName} ${shippingForm.lastName}, ${shippingForm.address}, ${shippingForm.city}, ${shippingForm.state} ${shippingForm.zip}, ${shippingForm.country}`

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
          paymentMethod: paymentMethod,
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

  const handlePlaceOrderWithPayPal = async (paypalDetails: any) => {
    setError('')
    try {
      const userStr = localStorage.getItem('user')
      const user = userStr ? JSON.parse(userStr) : null
      const userId = user?.id || null

      const shippingAddress = `${shippingForm.firstName} ${shippingForm.lastName}, ${shippingForm.address}, ${shippingForm.city}, ${shippingForm.state} ${shippingForm.zip}, ${shippingForm.country}`

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
          paymentMethod: 'PAYPAL',
          paypalOrderId: paypalDetails.id,
          paypalStatus: paypalDetails.status,
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
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              {STEPS.map((step, i) => (
                <div key={step} className="flex items-center">
                  <div className={cn('w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm transition-colors', i + 1 <= currentStep ? 'bg-joy-orange text-white' : 'bg-joy-gray-200 text-joy-gray-500')}>
                    {i + 1 < currentStep ? <Icons.Check size={14} className="sm:w-[18px] sm:h-[18px]" /> : i + 1}
                  </div>
                  <span className={cn('ml-1 sm:ml-2 font-medium text-xs sm:text-sm hidden xs:inline', i + 1 <= currentStep ? 'text-joy-gray-900' : 'text-joy-gray-400')}>{step}</span>
                  {i < STEPS.length - 1 && <div className={cn('w-6 sm:w-12 lg:w-20 h-0.5 mx-1 sm:mx-2 lg:mx-4', i + 1 < currentStep ? 'bg-joy-orange' : 'bg-joy-gray-200')} />}
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
                  <div className="space-y-3 sm:space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-joy-gray-50 rounded-xl">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-white flex-shrink-0">
                          <img src={parseProductImages(item.product.images)[0] || '/placeholder.png'} alt={item.product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-joy-gray-900 text-sm sm:text-base truncate">{item.product.name}</h3>
                          <p className="text-xs sm:text-sm text-joy-gray-500">SKU: {item.product.sku}</p>
                          {item.variant && <p className="text-xs sm:text-sm text-joy-gray-500">{item.variant.name}: {item.variant.value}</p>}
                          <div className="flex items-center justify-between mt-1 sm:mt-2">
                            <span className="text-xs sm:text-sm text-joy-gray-500">Qty: {item.quantity}{item.product.weight ? ` | ${item.product.weight}kg` : ''}</span>
                            <span className="font-semibold text-joy-orange text-sm sm:text-base">{formatCurrency(convertPrice(item.product.price * item.quantity, currency), currency)}</span>
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
                <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
                  <h2 className="font-semibold text-xl text-joy-gray-900">Shipping Information</h2>

                  {/* Saved Addresses Import */}
                  {hasSavedAuth && savedAddresses.length > 0 && (
                    <div className="bg-joy-orange/5 border border-joy-orange/20 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Icons.MapPin size={18} className="text-joy-orange" />
                          <span className="text-sm font-medium text-joy-gray-700">Import from saved address:</span>
                        </div>
                        <select
                          onChange={(e) => {
                            const addr = savedAddresses.find(a => a.id === e.target.value)
                            if (addr) {
                              updateShipping('firstName', addr.firstName)
                              updateShipping('lastName', addr.lastName)
                              updateShipping('email', addr.email)
                              updateShipping('phone', addr.phone)
                              updateShipping('address', addr.address)
                              updateShipping('city', addr.city)
                              updateShipping('state', addr.state)
                              updateShipping('zip', addr.zip)
                              updateShipping('country', addr.country)
                            }
                            e.target.value = ''
                          }}
                          className="flex-1 min-w-[200px] px-3 py-2 border border-joy-gray-200 rounded-lg text-sm focus:outline-none focus:border-joy-orange"
                          defaultValue=""
                        >
                          <option value="">Select an address...</option>
                          {savedAddresses.map(addr => (
                            <option key={addr.id} value={addr.id}>
                              {addr.label}{addr.isDefault ? ' (Default)' : ''} — {addr.city}, {addr.state}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input label="First Name *" placeholder="John" value={shippingForm.firstName} onChange={e => updateShipping('firstName', e.target.value)} className={shippingErrors.firstName ? 'border-red-500' : ''} />
                      {shippingErrors.firstName && <p className="text-red-500 text-xs mt-1">{shippingErrors.firstName}</p>}
                    </div>
                    <div>
                      <Input label="Last Name *" placeholder="Smith" value={shippingForm.lastName} onChange={e => updateShipping('lastName', e.target.value)} className={shippingErrors.lastName ? 'border-red-500' : ''} />
                      {shippingErrors.lastName && <p className="text-red-500 text-xs mt-1">{shippingErrors.lastName}</p>}
                    </div>
                  </div>
                  <div>
                    <Input label="Email *" type="email" placeholder="john@example.com" value={shippingForm.email} onChange={e => updateShipping('email', e.target.value)} className={shippingErrors.email ? 'border-red-500' : ''} />
                    {shippingErrors.email && <p className="text-red-500 text-xs mt-1">{shippingErrors.email}</p>}
                  </div>
                  <div>
                    <Input label="Phone *" type="tel" placeholder="+1 (555) 000-0000" value={shippingForm.phone} onChange={e => updateShipping('phone', e.target.value)} className={shippingErrors.phone ? 'border-red-500' : ''} />
                    {shippingErrors.phone && <p className="text-red-500 text-xs mt-1">{shippingErrors.phone}</p>}
                  </div>
                  <div>
                    <Input label="Address *" placeholder="123 Main St" value={shippingForm.address} onChange={e => updateShipping('address', e.target.value)} className={shippingErrors.address ? 'border-red-500' : ''} />
                    {shippingErrors.address && <p className="text-red-500 text-xs mt-1">{shippingErrors.address}</p>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <Input label="City *" placeholder="New York" value={shippingForm.city} onChange={e => updateShipping('city', e.target.value)} className={shippingErrors.city ? 'border-red-500' : ''} />
                      {shippingErrors.city && <p className="text-red-500 text-xs mt-1">{shippingErrors.city}</p>}
                    </div>
                    <div>
                      <Input label="State *" placeholder="NY" value={shippingForm.state} onChange={e => updateShipping('state', e.target.value)} className={shippingErrors.state ? 'border-red-500' : ''} />
                      {shippingErrors.state && <p className="text-red-500 text-xs mt-1">{shippingErrors.state}</p>}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Input label="ZIP *" placeholder="10001" value={shippingForm.zip} onChange={e => updateShipping('zip', e.target.value)} className={shippingErrors.zip ? 'border-red-500' : ''} />
                      {shippingErrors.zip && <p className="text-red-500 text-xs mt-1">{shippingErrors.zip}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Country / Region *</label>
                    <select className={`w-full px-4 py-3 rounded-xl border-2 focus:border-joy-orange focus:outline-none ${shippingErrors.country ? 'border-red-500' : 'border-joy-gray-200'}`} value={shippingForm.country} onChange={e => updateShipping('country', e.target.value)}>
                      <option value="">Select Country / Region</option>
                      {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    {shippingErrors.country && <p className="text-red-500 text-xs mt-1">{shippingErrors.country}</p>}
                  </div>

                  {/* Shipping Options */}
                  <div className="border-t border-joy-gray-100 pt-6">
                    <h3 className="font-medium text-joy-gray-900 mb-4">Shipping Method ({totalWeight.toFixed(2)}kg total)</h3>
                    {shippingOptions.length === 0 ? (
                      <p className="text-red-500 text-sm">Unable to deliver to this address!</p>
                    ) : (
                      <div className="space-y-3">
                        {shippingOptions.filter(o => o.available).map(option => (
                          <label key={option.id} className={cn('flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-colors', selectedShipping === option.id ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-orange')}>
                            <div className="flex items-center gap-3">
                              <input type="radio" name="shipping" checked={selectedShipping === option.id} onChange={() => setSelectedShipping(option.id)} className="accent-joy-orange" />
                              <div>
                                <p className="font-medium text-joy-gray-900">{option.name}</p>
                                <p className="text-sm text-joy-gray-500">{option.estimatedDays}</p>
                              </div>
                            </div>
                            <span className="font-semibold text-joy-gray-900">
                              {option.freeShipping ? <span className="text-joy-green">FREE</span> : formatCurrency(option.cost, currency)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    {shippingOptions.length > 0 && !selectedOption?.freeShipping && (
                      <p className="text-sm text-joy-gray-500 mt-3">
                        Add {formatCurrency((selectedOption?.cost || 0) * 5, currency)} more for free express shipping
                      </p>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <Button variant="secondary" onClick={() => setCurrentStep(1)}>Back</Button>
                    <Button onClick={() => { if (validateShippingForm()) setCurrentStep(3) }} className="flex-1" size="lg">
                      Continue to Payment <Icons.ChevronRight size={18} className="ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="font-semibold text-xl text-joy-gray-900 mb-6">Payment Method</h2>
                  <div className="space-y-3 sm:space-y-4 mb-6">
                    {/* Credit / Debit Card (Stripe) */}
                    <label className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'STRIPE' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-orange'}`}>
                      <input type="radio" name="payment" checked={paymentMethod === 'STRIPE'} onChange={() => setPaymentMethod('STRIPE')} className="accent-joy-orange" />
                      <Icons.CreditCard size={20} className="sm:w-6 sm:h-6 text-joy-gray-600" />
                      <div className="min-w-0">
                        <span className="font-medium text-sm sm:text-base">Credit / Debit Card</span>
                        <p className="text-xs sm:text-sm text-joy-gray-500 hidden xs:block">Visa, Mastercard, American Express</p>
                      </div>
                    </label>

                    {/* PayPal */}
                    <label className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'PAYPAL' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-orange'}`}>
                      <input type="radio" name="payment" checked={paymentMethod === 'PAYPAL'} onChange={() => setPaymentMethod('PAYPAL')} className="accent-joy-orange" />
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h12.004c.524 0 .972.382 1.054.901l3.107 19.696a.641.641 0 0 1-.633.74h-4.606a.75.75 0 0 1-.612-.314l-1.937-2.754-1.937 2.754a.75.75 0 0 1-.612.314H7.076z"/></svg>
                      <div className="min-w-0">
                        <span className="font-medium text-sm sm:text-base">PayPal</span>
                        <p className="text-xs sm:text-sm text-joy-gray-500 hidden xs:block">Pay securely with your PayPal account</p>
                      </div>
                    </label>

                    {/* Bank Transfer */}
                    <label className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'BANK_TRANSFER' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-orange'}`}>
                      <input type="radio" name="payment" checked={paymentMethod === 'BANK_TRANSFER'} onChange={() => setPaymentMethod('BANK_TRANSFER')} className="accent-joy-orange" />
                      <Icons.Globe size={20} className="sm:w-6 sm:h-6 text-joy-gray-600" />
                      <div className="min-w-0">
                        <span className="font-medium text-sm sm:text-base">Bank Transfer / Wire</span>
                        <p className="text-xs sm:text-sm text-joy-gray-500 hidden xs:block">Direct bank transfer (T/T wire)</p>
                      </div>
                    </label>
                  </div>

                  {/* Stripe Card Form (shown when Stripe is selected) */}
                  {paymentMethod === 'STRIPE' && (
                    <div className="space-y-4 border-t border-joy-gray-100 pt-6">
                      <Input label="Card Number" placeholder="4242 4242 4242 4242" />
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Expiry Date" placeholder="MM/YY" />
                        <Input label="CVC" placeholder="123" />
                      </div>
                      <Input label="Name on Card" placeholder="John Smith" />
                    </div>
                  )}

                  {/* Bank Transfer Info (shown when Bank Transfer is selected) */}
                  {paymentMethod === 'BANK_TRANSFER' && (
                    <div className="border-t border-joy-gray-100 pt-6 space-y-4">
                      <div className="bg-joy-gray-50 rounded-xl p-4 space-y-3">
                        <p className="font-medium text-sm">Bank Transfer Instructions</p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <span className="text-joy-gray-500">Bank Name:</span>
                          <span className="col-span-2 font-medium">Bank of America</span>
                          <span className="text-joy-gray-500">Account Name:</span>
                          <span className="col-span-2 font-medium">Fiestaflare Inc.</span>
                          <span className="text-joy-gray-500">Account Number:</span>
                          <span className="col-span-2 font-medium">XXXX XXXX XXXX 1234</span>
                          <span className="text-joy-gray-500">SWIFT/BIC:</span>
                          <span className="col-span-2 font-medium">BOFAUS3N</span>
                        </div>
                      </div>
                      <p className="text-sm text-joy-gray-500">Please include your order number in the payment reference. Your order will be processed after payment is received (usually 2-5 business days).</p>
                    </div>
                  )}

                  {paymentMethod === 'PAYPAL' && (
                    <div className="border-t border-joy-gray-100 pt-6">
                      <div id="paypal-button-container" className="mt-4" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4 text-sm text-joy-gray-500">
                    <Icons.Lock size={16} />
                    <span>Your payment information is encrypted and secure</span>
                  </div>
                  {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                  {paymentMethod === 'PAYPAL' && !paypalLoaded && (
                    <div className="flex gap-4 mt-6">
                      <Button variant="secondary" onClick={() => setCurrentStep(2)}>Back</Button>
                      <Button className="flex-1" size="lg" disabled>
                        {paypalClientId ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            Loading PayPal...
                          </span>
                        ) : 'PayPal Not Configured'}
                      </Button>
                    </div>
                  )}
                  {paymentMethod !== 'PAYPAL' && (
                    <div className="flex gap-4 mt-6">
                      <Button variant="secondary" onClick={() => setCurrentStep(2)}>Back</Button>
                      <Button onClick={handlePlaceOrder} className="flex-1" size="lg" isLoading={isProcessing}>
                        {isProcessing ? 'Processing...' : paymentMethod === 'BANK_TRANSFER' ? `Place Order (Bank Transfer)` : `Pay ${formatCurrency(total, currency)}`}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 4 && (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-joy-green/10 flex items-center justify-center mx-auto mb-4">
                    <Icons.Check size={40} className="text-joy-green" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">Order Placed!</h2>
                  <p className="text-joy-gray-600 mb-6">Thank you for your order. We'll send you a confirmation email shortly.</p>
                  {orderNumber && <p className="font-mono text-lg bg-joy-gray-50 rounded-lg py-3 px-4 inline-block mb-6">Order #{orderNumber}</p>}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/account/orders"><Button variant="secondary">View Order</Button></Link>
                    <Link href="/products"><Button>Continue Shopping</Button></Link>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 sticky top-40">
                <h3 className="font-semibold text-base sm:text-lg text-joy-gray-900 mb-4">Order Summary</h3>
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  {items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex gap-2 sm:gap-3">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-joy-gray-100 flex-shrink-0">
                        <img src={parseProductImages(item.product.images)[0] || '/placeholder.png'} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-joy-gray-900 truncate">{item.product.name}</p>
                        <p className="text-xs text-joy-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-joy-gray-900">{formatCurrency(convertPrice(item.product.price * item.quantity, currency), currency)}</p>
                    </div>
                  ))}
                  {items.length > 3 && <p className="text-xs sm:text-sm text-joy-gray-500 text-center">+ {items.length - 3} more items</p>}
                </div>
                <div className="border-t border-joy-gray-100 pt-3 sm:pt-4 space-y-2 sm:space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-joy-gray-600">Subtotal</span><span className="font-medium">{formatCurrency(subtotal, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-joy-gray-600">Shipping ({totalWeight.toFixed(2)}kg)</span><span className="font-medium">{shippingCost === 0 ? <span className="text-joy-green">FREE</span> : formatCurrency(shippingCost, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-joy-gray-600">Tax (8%)</span><span className="font-medium">{formatCurrency(tax, currency)}</span></div>
                  <div className="flex justify-between text-base sm:text-lg font-bold pt-2 sm:pt-3 border-t border-joy-gray-100"><span>Total</span><span className="text-joy-orange">{formatCurrency(total, currency)}</span></div>
                </div>
                <div className="mt-4 sm:mt-6">
                  <label className="block text-sm font-medium text-joy-gray-700 mb-2">Display Currency</label>
                  <select value={currency} onChange={e => useCartStore.getState().setCurrency(e.target.value as Currency)} className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 border-joy-gray-200 text-sm focus:border-joy-orange focus:outline-none">
                    <option value="USD">$ USD</option><option value="MXN">MX$ MXN</option><option value="BRL">R$ BRL</option>
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

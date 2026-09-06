'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'

interface Order {
  id: string
  orderNumber: string
  status: string
  subtotal: number
  shippingCost: number
  tax: number
  discount: number
  total: number
  currency: string
  items: string
  shippingAddress: string
  paymentMethod: string
  paymentId?: string
  trackingNumber: string | null
  createdAt: string
}

interface OrderItem {
  productId: string
  name: string
  sku: string
  price: number
  quantity: number
  variant?: string
  image?: string
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
}

export default function OrderDetailPage() {
  const params = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [productImages, setProductImages] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isPaying, setIsPaying] = useState(false)
  const [paypalClientId, setPaypalClientId] = useState('')
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<'PAYPAL' | 'STRIPE' | 'BANK_TRANSFER'>('PAYPAL')
  const [error, setError] = useState('')

  useEffect(() => {
    if (params.orderId) {
      fetchOrder(params.orderId as string)
      fetchPaymentSettings()
    }
  }, [params.orderId])

  const fetchOrder = async (orderId: string) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setOrder(data.data)
        // Parse items
        let parsedItems: OrderItem[] = []
        try {
          parsedItems = JSON.parse(data.data.items)
        } catch {}
        setItems(parsedItems)
        // Fetch product images
        fetchProductImages(parsedItems)
      }
    } catch (err) { console.error(err) }
    finally { setIsLoading(false) }
  }

  const fetchProductImages = async (orderItems: OrderItem[]) => {
    const images: Record<string, string> = {}
    for (const item of orderItems) {
      if (item.productId && !item.image) {
        try {
          const res = await fetch(`/api/products/id/${item.productId}`)
          const data = await res.json()
          if (data.success && data.data) {
            // images may be a JSON string or an array
            let imgUrl = ''
            const imgField = data.data.images
            if (typeof imgField === 'string') {
              const parsed = JSON.parse(imgField)
              imgUrl = parsed[0] || ''
            } else if (Array.isArray(imgField) && imgField[0]) {
              imgUrl = imgField[0]
            }
            if (imgUrl) {
              images[item.productId] = imgUrl
            }
          }
        } catch {}
      } else if (item.image) {
        images[item.productId] = item.image
      }
    }
    setProductImages(images)
  }

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch('/api/site/payment-settings')
      const data = await res.json()
      if (data.success && data.data.paypal?.clientId) {
        setPaypalClientId(data.data.paypal.clientId)
      }
    } catch (err) { console.error(err) }
  }

  const handlePayPalPayment = async (paypalDetails: any) => {
    if (!order) return
    setIsPaying(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/orders/${order.orderNumber}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'PAID',
          paymentId: paypalDetails.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setOrder({ ...order, status: 'PAID', paymentMethod: 'PAYPAL' })
      } else {
        setError(data.error || 'Payment failed')
      }
    } catch (err) {
      setError('Payment failed. Please try again.')
      console.error(err)
    } finally {
      setIsPaying(false)
    }
  }

  const handlePayNow = async () => {
    if (!order) return
    setIsPaying(true)
    setError('')
    
    if (selectedPayment === 'BANK_TRANSFER') {
      alert('Please transfer the amount to our bank account and include the order number in the reference. Your order will be processed after payment is received.')
      setIsPaying(false)
      return
    }
    
    if (selectedPayment === 'PAYPAL') {
      // PayPal payment is handled by the SDK buttons
      return
    }
  }

  // Load PayPal SDK for pending PAYPAL orders
  useEffect(() => {
    if (!order || order.status !== 'PENDING' || !paypalClientId) return
    if (selectedPayment !== 'PAYPAL') return

    const containerEl = document.getElementById('paypal-paynow-container') as HTMLDivElement | null
    if (!containerEl) return
    containerEl.innerHTML = ''

    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD`
    script.async = true
    script.onload = () => {
      const paypal = (window as any).paypal
      if (!paypal || !containerEl) return
      setPaypalLoaded(true)
      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
        createOrder: (_data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [{ amount: { value: order.total.toFixed(2) } }]
          })
        },
        onApprove: async (_data: any, actions: any) => {
          setIsPaying(true)
          try {
            const details = await actions.order.capture()
            await handlePayPalPayment(details)
          } catch (err) {
            setError('Payment capture failed. Please try again.')
            setIsPaying(false)
          }
        },
        onError: (err: any) => {
          console.error('PayPal error:', err)
          setError('PayPal payment failed. Please try again.')
        }
      }).render(containerEl)
    }
    document.body.appendChild(script)
  }, [order, paypalClientId, selectedPayment])

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!order) return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-joy-gray-900 mb-2">Order Not Found</h2>
          <Link href="/account/orders" className="text-joy-orange hover:underline">Back to Orders</Link>
        </div>
      </main>
      <Footer />
    </div>
  )

  const isPending = order.status === 'PENDING'

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/account/orders" className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.ChevronLeft size={20} /></Link>
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Order #{order.orderNumber}</h1>
              <p className="text-joy-gray-500 mt-1">{new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Status */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-joy-gray-500 mb-1">Order Status</p>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>{order.status}</span>
                </div>
                {order.trackingNumber && (
                  <div className="text-right">
                    <p className="text-sm text-joy-gray-500 mb-1">Tracking</p>
                    <p className="font-mono text-joy-orange">{order.trackingNumber}</p>
                  </div>
                )}
              </div>

              {/* Pay Now Section for Pending Orders */}
              {isPending && (
                <div className="mt-6 pt-6 border-t border-joy-gray-100">
                  <h3 className="font-semibold text-lg text-joy-gray-900 mb-4">Complete Your Payment</h3>
                  
                  {/* Payment Method Selection */}
                  <div className="mb-4">
                    <p className="text-sm text-joy-gray-500 mb-2">Select Payment Method:</p>
                    <div className="flex flex-wrap gap-3">
                      <label className={`flex items-center gap-2 px-4 py-2 border-2 rounded-xl cursor-pointer transition-colors ${selectedPayment === 'PAYPAL' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-gray-300'}`}>
                        <input type="radio" name="payment" checked={selectedPayment === 'PAYPAL'} onChange={() => setSelectedPayment('PAYPAL')} className="accent-joy-orange" />
                        <span className="font-medium">PayPal</span>
                      </label>
                      <label className={`flex items-center gap-2 px-4 py-2 border-2 rounded-xl cursor-pointer transition-colors ${selectedPayment === 'STRIPE' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-gray-300'}`}>
                        <input type="radio" name="payment" checked={selectedPayment === 'STRIPE'} onChange={() => setSelectedPayment('STRIPE')} className="accent-joy-orange" />
                        <span className="font-medium">Credit Card</span>
                      </label>
                      <label className={`flex items-center gap-2 px-4 py-2 border-2 rounded-xl cursor-pointer transition-colors ${selectedPayment === 'BANK_TRANSFER' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-gray-300'}`}>
                        <input type="radio" name="payment" checked={selectedPayment === 'BANK_TRANSFER'} onChange={() => setSelectedPayment('BANK_TRANSFER')} className="accent-joy-orange" />
                        <span className="font-medium">Bank Transfer</span>
                      </label>
                    </div>
                  </div>

                  {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                  {/* PayPal Button */}
                  {selectedPayment === 'PAYPAL' && (
                    <div>
                      <div id="paypal-paynow-container" className="max-w-sm" />
                      {!paypalLoaded && paypalClientId && <p className="text-sm text-joy-gray-400 mt-2">Loading PayPal...</p>}
                      {!paypalClientId && <p className="text-sm text-red-400 mt-2">PayPal is not configured. Please contact support.</p>}
                    </div>
                  )}

                  {/* Stripe Button */}
                  {selectedPayment === 'STRIPE' && (
                    <div className="bg-joy-gray-50 rounded-xl p-4 max-w-sm">
                      <p className="text-sm text-joy-gray-600 mb-3">Credit card payment via Stripe</p>
                      <Button 
                        onClick={handlePayNow} 
                        isLoading={isPaying}
                        className="w-full"
                      >
                        Pay ${order.total.toFixed(2)} with Card
                      </Button>
                      <p className="text-xs text-joy-gray-400 mt-2 text-center">Stripe integration coming soon</p>
                    </div>
                  )}

                  {/* Bank Transfer Instructions */}
                  {selectedPayment === 'BANK_TRANSFER' && (
                    <div className="bg-joy-gray-50 rounded-xl p-4 max-w-lg">
                      <p className="text-sm font-medium text-joy-gray-700 mb-2">Bank Transfer Instructions:</p>
                      <div className="text-sm text-joy-gray-600 space-y-1">
                        <p>Amount: <strong>${order.total.toFixed(2)} {order.currency}</strong></p>
                        <p>Order Reference: <strong>#{order.orderNumber}</strong></p>
                        <p className="pt-2 text-joy-gray-500">Please include your order number as the payment reference. Your order will be processed after payment is received (2-5 business days).</p>
                      </div>
                      <Button 
                        onClick={handlePayNow} 
                        isLoading={isPaying}
                        className="w-full mt-4"
                        variant="secondary"
                      >
                        I've Made the Transfer
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Already Paid - Show confirmation */}
              {order.status === 'PAID' && (
                <div className="mt-6 pt-6 border-t border-joy-gray-100">
                  <div className="flex items-center gap-2 text-green-600">
                    <Icons.Check size={20} />
                    <span className="font-medium">Payment Received</span>
                  </div>
                  {order.paymentId && <p className="text-sm text-joy-gray-500 mt-1">Transaction ID: {order.paymentId}</p>}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Items</h2>
              <div className="space-y-4">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-joy-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                      {productImages[item.productId] ? (
                        <img src={productImages[item.productId]} alt={item.name} className="w-full h-full object-cover" />
                      ) : item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Icons.Package size={24} className="text-joy-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-joy-gray-900">{item.name}</p>
                      <p className="text-sm text-joy-gray-500">SKU: {item.sku} {item.variant ? `| ${item.variant}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-joy-gray-900">{order.currency} ${item.price.toFixed(2)}</p>
                      <p className="text-sm text-joy-gray-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping & Payment */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Shipping Address</h2>
                <p className="text-joy-gray-600 whitespace-pre-line">{order.shippingAddress}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Order Summary</h2>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-joy-gray-500">Subtotal</span><span>{order.currency} ${order.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-joy-gray-500">Shipping</span><span>{order.currency} ${order.shippingCost.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-joy-gray-500">Tax</span><span>{order.currency} ${order.tax.toFixed(2)}</span></div>
                  {order.discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span>-{order.currency} ${order.discount.toFixed(2)}</div>}
                  <div className="flex justify-between font-bold pt-2 border-t border-joy-gray-100"><span>Total</span><span className="text-joy-orange">{order.currency} ${order.total.toFixed(2)}</span></div>
                </div>
                <div className="mt-4 pt-4 border-t border-joy-gray-100">
                  <p className="text-sm text-joy-gray-500">Payment Method</p>
                  <p className="font-medium text-joy-gray-900">{order.paymentMethod === 'CARD' ? 'Credit/Debit Card' : order.paymentMethod}</p>
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

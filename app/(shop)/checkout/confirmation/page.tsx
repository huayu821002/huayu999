'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'

export default function CheckoutConfirmationPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order') || ''
  const [orderData, setOrderData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails(orderId)
    } else {
      setIsLoading(false)
    }
  }, [orderId])

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      const data = await res.json()
      if (data.success) {
        setOrderData(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch order:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-2xl mx-auto px-4 py-16">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="text-center mb-12">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-joy-green/10 flex items-center justify-center">
                  <Icons.Check size={40} className="text-joy-green" />
                </div>
                <h1 className="font-display text-3xl font-bold text-joy-gray-900 mb-4">
                  Order Confirmed!
                </h1>
                <p className="text-joy-gray-600">
                  Thank you for your order. We'll send you a confirmation email shortly.
                </p>
                {orderId && (
                  <p className="mt-2 font-mono text-joy-orange font-semibold">
                    Order #{orderId}
                  </p>
                )}
              </div>

              {orderData && (
                <div className="bg-joy-gray-50 rounded-2xl p-6 mb-8">
                  <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Order Details</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-joy-gray-500">Order Number</span>
                      <span className="font-medium text-joy-gray-900">{orderData.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-joy-gray-500">Status</span>
                      <span className="px-3 py-1 bg-joy-orange/10 text-joy-orange text-xs font-medium rounded-full">
                        {orderData.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-joy-gray-500">Total</span>
                      <span className="font-semibold text-joy-orange">${orderData.total?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <Link href="/account/orders" className="block w-full">
                  <Button variant="secondary" className="w-full">
                    View My Orders
                  </Button>
                </Link>
                <Link href="/products" className="block w-full">
                  <Button className="w-full bg-joy-orange hover:bg-joy-orange/90 text-white">
                    Continue Shopping
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'

interface Order {
  id: string
  orderNumber: string
  status: string
  total: number
  currency: string
  items: string
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
}

export default function AccountOrdersPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    const token = localStorage.getItem('user')
    if (!token) { router.push('/login'); return }
    fetchOrders()
  }, [router])

  const fetchOrders = async () => {
    try {
      const userStr = localStorage.getItem('user')
      const user = userStr ? JSON.parse(userStr) : null
      if (!user) return

      const res = await fetch(`/api/orders?userId=${user.id}`)
      const data = await res.json()
      if (data.success) setOrders(data.data)
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/account" className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.ChevronLeft size={20} /></Link>
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">My Orders</h1>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <Icons.Package size={48} className="mx-auto text-joy-gray-300 mb-4" />
              <h2 className="font-semibold text-lg text-joy-gray-900 mb-2">No Orders Yet</h2>
              <p className="text-joy-gray-500 mb-6">Start shopping to see your orders here</p>
              <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-joy-orange text-white rounded-xl font-medium hover:bg-joy-orange/90 transition-colors">
                Browse Products <Icons.ChevronRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                let items = []
                try { items = JSON.parse(order.items) } catch {}
                return (
                  <div key={order.id} className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-mono font-semibold text-joy-gray-900">{order.orderNumber}</p>
                        <p className="text-sm text-joy-gray-500 mt-1">
                          {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mb-4 text-sm text-joy-gray-600">
                      <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                      <span className="font-semibold text-joy-orange">{order.currency} ${order.total.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/account/orders/${order.orderNumber}`}>
                        <Button variant="secondary" size="sm">View Details</Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

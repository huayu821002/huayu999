'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'

interface Order {
  id: string
  orderNumber: string
  userId: string
  status: string
  items: string
  subtotal: number
  shippingCost: number
  tax: number
  discount: number
  total: number
  currency: string
  shippingAddress: string
  paymentMethod: string
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  Processing: 'bg-joy-orange/10 text-joy-orange',
  Shipped: 'bg-joy-navy/10 text-joy-navy',
  DELIVERED: 'bg-joy-green/10 text-joy-green',
  Cancelled: 'bg-red-100 text-red-700',
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) { router.push('/login'); return }
    try {
      const user = JSON.parse(userStr)
      if (user.role !== 'ADMIN') { router.push('/login'); return }
      setIsAdmin(true)
    } catch { router.push('/login') }
    setIsLoading(false)
  }, [router])

  useEffect(() => {
    if (!isAdmin) return
    fetchOrders()
  }, [isAdmin])

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders')
      const data = await res.json()
      if (data.success) setOrders(data.data)
    } catch (err) { console.error(err) }
  }

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  const filtered = orders.filter(o => {
    const matchSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const formatAddress = (addr: string) => {
    try {
      const parsed = JSON.parse(addr)
      return `${parsed.street || ''}, ${parsed.city || ''}, ${parsed.state || ''} ${parsed.zipCode || ''}`
    } catch { return addr }
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Orders</h1>
              <p className="text-joy-gray-600">{orders.length} orders</p>
            </div>
            <Link href="/admin/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-joy-gray-100 flex gap-4 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-joy-gray-400" />
                <input type="text" placeholder="Search by order #..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none">
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-joy-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Order</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Date</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Total</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-joy-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-joy-gray-500">No orders found</td></tr>
                  ) : filtered.map((order) => (
                    <tr key={order.id} className="hover:bg-joy-gray-50 transition-colors">
                      <td className="px-6 py-4"><span className="font-mono text-sm font-medium text-joy-orange">{order.orderNumber}</span></td>
                      <td className="px-6 py-4 text-sm text-joy-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-semibold text-joy-orange">${order.total.toFixed(2)}</td>
                      <td className="px-6 py-4"><span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-joy-gray-100 text-joy-gray-600'}`}>{order.status}</span></td>
                      <td className="px-6 py-4 text-sm text-joy-gray-600">{order.paymentMethod || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

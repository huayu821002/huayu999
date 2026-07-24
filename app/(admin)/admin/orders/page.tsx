'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'

const ORDERS = [
  { id: '1', orderNumber: 'JH-LX4K2M-AB7C', customer: 'Maria Santos', email: 'maria@example.com', items: 12, total: '$459.99', status: 'Processing', date: '2024-01-15', payment: 'Paid' },
  { id: '2', orderNumber: 'JH-K9J3N8-CD5E', customer: 'John Smith', email: 'john@example.com', items: 5, total: '$189.50', status: 'Shipped', date: '2024-01-15', payment: 'Paid' },
  { id: '3', orderNumber: 'JH-M2P7Q4-EF9G', customer: 'Ana Rodriguez', email: 'ana@example.com', items: 23, total: '$892.00', status: 'Pending', date: '2024-01-14', payment: 'Pending' },
  { id: '4', orderNumber: 'JH-N5R1T6-GH2I', customer: 'Carlos Mendez', email: 'carlos@example.com', items: 8, total: '$267.75', status: 'Delivered', date: '2024-01-14', payment: 'Paid' },
  { id: '5', orderNumber: 'JH-Q8S2U6-IJ3K', customer: 'Emily Chen', email: 'emily@example.com', items: 15, total: '$678.30', status: 'Processing', date: '2024-01-13', payment: 'Paid' },
]

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Processing: 'bg-joy-orange/10 text-joy-orange',
  Shipped: 'bg-joy-navy/10 text-joy-navy',
  Delivered: 'bg-joy-green/10 text-joy-green',
  Cancelled: 'bg-red-100 text-red-700',
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
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

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  const filtered = ORDERS.filter(o => {
    const matchSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">Orders</h1>
            <Link href="/admin/dashboard"><Button variant="secondary">← Back to Dashboard</Button></Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-joy-gray-100 flex gap-4 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-joy-gray-400" />
                <input
                  type="text"
                  placeholder="Search by order # or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none focus:ring-2 focus:ring-joy-orange/20"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-joy-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Order</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Customer</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Items</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Total</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Payment</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Date</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-joy-gray-100">
                  {filtered.map((order) => (
                    <tr key={order.id} className="hover:bg-joy-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-medium text-joy-orange">{order.orderNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-joy-gray-900">{order.customer}</p>
                          <p className="text-xs text-joy-gray-500">{order.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-joy-gray-600">{order.items}</td>
                      <td className="px-6 py-4 font-semibold text-joy-orange">{order.total}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${order.payment === 'Paid' ? 'bg-joy-green/10 text-joy-green' : 'bg-yellow-100 text-yellow-700'}`}>{order.payment}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-joy-gray-500">{order.date}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-2 hover:bg-joy-gray-100 rounded-lg transition-colors"><Icons.Eye size={18} className="text-joy-gray-500" /></button>
                        </div>
                      </td>
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

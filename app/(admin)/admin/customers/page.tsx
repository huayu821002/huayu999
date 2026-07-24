'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'

const CUSTOMERS = [
  { id: '1', name: 'Maria Santos', email: 'maria@example.com', orders: 12, total: '$4,521.00', status: 'Active', joinDate: '2024-01-15' },
  { id: '2', name: 'John Smith', email: 'john@example.com', orders: 8, total: '$2,890.50', status: 'Active', joinDate: '2024-01-10' },
  { id: '3', name: 'Ana Rodriguez', email: 'ana@example.com', orders: 23, total: '$8,920.00', status: 'VIP', joinDate: '2023-12-01' },
  { id: '4', name: 'Carlos Mendez', email: 'carlos@example.com', orders: 5, total: '$1,234.75', status: 'Active', joinDate: '2024-01-20' },
]

export default function AdminCustomersPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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

  const filtered = CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">Customers</h1>
            <Link href="/admin/dashboard"><Button variant="secondary">← Back to Dashboard</Button></Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-joy-gray-100">
              <div className="relative max-w-md">
                <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-joy-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none focus:ring-2 focus:ring-joy-orange/20"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-joy-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Customer</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Email</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Orders</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Total Spent</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-joy-gray-100">
                  {filtered.map((customer) => (
                    <tr key={customer.id} className="hover:bg-joy-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-joy-orange/10 text-joy-orange font-bold flex items-center justify-center">
                            {customer.name.charAt(0)}
                          </div>
                          <span className="font-medium text-joy-gray-900">{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-joy-gray-600">{customer.email}</td>
                      <td className="px-6 py-4 text-joy-gray-600">{customer.orders}</td>
                      <td className="px-6 py-4 font-semibold text-joy-orange">{customer.total}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          customer.status === 'VIP' ? 'bg-joy-orange/10 text-joy-orange' : 'bg-joy-green/10 text-joy-green'
                        }`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-joy-gray-500">{customer.joinDate}</td>
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

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Icons } from '@/components/ui/Icons'

const STATS = [
  { label: 'Total Revenue', value: '$124,592', change: '+12.5%', icon: Icons.DollarSign, color: 'text-joy-green' },
  { label: 'Orders', value: '1,284', change: '+8.2%', icon: Icons.Package, color: 'text-joy-orange' },
  { label: 'Customers', value: '3,847', change: '+24.3%', icon: Icons.User, color: 'text-joy-pink' },
  { label: 'Conversion Rate', value: '3.24%', change: '-0.4%', icon: Icons.TrendUp, color: 'text-joy-navy' },
]

const RECENT_ORDERS = [
  { id: 'JH-LX4K2M-AB7C', customer: 'Maria Santos', items: 12, total: '$459.99', status: 'Processing', time: '2 min ago' },
  { id: 'JH-K9J3N8-CD5E', customer: 'John Smith', items: 5, total: '$189.50', status: 'Shipped', time: '15 min ago' },
  { id: 'JH-M2P7Q4-EF9G', customer: 'Ana Rodriguez', items: 23, total: '$892.00', status: 'Pending', time: '32 min ago' },
  { id: 'JH-N5R1T6-GH2I', customer: 'Carlos Mendez', items: 8, total: '$267.75', status: 'Delivered', time: '1 hr ago' },
]

const TOP_PRODUCTS = [
  { name: 'Crystal Beaded Necklace', sales: 234, revenue: '$3,042' },
  { name: 'LED Pet Collar', sales: 189, revenue: '$3,023' },
  { name: 'Nordic Desk Organizer', sales: 156, revenue: '$4,523' },
  { name: 'Ceramic Vase Set', sales: 134, revenue: '$4,689' },
]

export default function AdminDashboard() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    
    if (!token || !userStr) {
      router.push('/login')
      return
    }
    
    try {
      const user = JSON.parse(userStr)
      if (user.role !== 'ADMIN') {
        router.push('/login')
        return
      }
      setIsAdmin(true)
    } catch {
      router.push('/login')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">Dashboard</h1>
            <p className="text-joy-gray-600">Welcome back! Here is what is happening with your store.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-joy-gray-50 flex items-center justify-center ${stat.color}`}>
                    <stat.icon size={24} />
                  </div>
                  <span className={`text-sm font-medium ${stat.change.startsWith('+') ? 'text-joy-green' : 'text-red-500'}`}>
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-joy-gray-900 mb-1">{stat.value}</p>
                <p className="text-sm text-joy-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm">
              <div className="p-6 border-b border-joy-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg text-joy-gray-900">Recent Orders</h2>
                  <Link href="/admin/orders" className="text-sm text-joy-orange hover:underline">
                    View All
                  </Link>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-joy-gray-50">
                    <tr>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-3">Order</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-3">Customer</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-3">Total</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-joy-gray-100">
                    {RECENT_ORDERS.map((order) => (
                      <tr key={order.id} className="hover:bg-joy-gray-50 transition-colors">
                        <td className="px-6 py-4"><span className="font-mono text-sm">{order.id}</span></td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-joy-gray-900">{order.customer}</div>
                          <div className="text-xs text-joy-gray-500">{order.items} items</div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-joy-gray-900">{order.total}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            order.status === 'Delivered' ? 'bg-joy-green/10 text-joy-green' :
                            order.status === 'Shipped' ? 'bg-joy-navy/10 text-joy-navy' :
                            order.status === 'Processing' ? 'bg-joy-orange/10 text-joy-orange' :
                            'bg-joy-gray-100 text-joy-gray-600'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-joy-gray-500">{order.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm">
              <div className="p-6 border-b border-joy-gray-100">
                <h2 className="font-semibold text-lg text-joy-gray-900">Top Products</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {TOP_PRODUCTS.map((product, i) => (
                    <div key={product.name} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-joy-orange/10 text-joy-orange font-bold text-sm flex items-center justify-center">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-joy-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-joy-gray-500">{product.sales} sales</p>
                      </div>
                      <p className="font-semibold text-joy-green">{product.revenue}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/admin/products" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 rounded-xl bg-joy-orange/10 flex items-center justify-center mb-4 group-hover:bg-joy-orange/20 transition-colors">
                <Icons.Plus size={24} className="text-joy-orange" />
              </div>
              <h3 className="font-semibold text-joy-gray-900">Add Product</h3>
              <p className="text-sm text-joy-gray-500">Create new listing</p>
            </Link>
            <Link href="/admin/orders" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 rounded-xl bg-joy-pink/10 flex items-center justify-center mb-4 group-hover:bg-joy-pink/20 transition-colors">
                <Icons.Package size={24} className="text-joy-pink" />
              </div>
              <h3 className="font-semibold text-joy-gray-900">Manage Orders</h3>
              <p className="text-sm text-joy-gray-500">View and process orders</p>
            </Link>
            <Link href="/admin/customers" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 rounded-xl bg-joy-green/10 flex items-center justify-center mb-4 group-hover:bg-joy-green/20 transition-colors">
                <Icons.User size={24} className="text-joy-green" />
              </div>
              <h3 className="font-semibold text-joy-gray-900">Customers</h3>
              <p className="text-sm text-joy-gray-500">Manage customer accounts</p>
            </Link>
            <Link href="/admin/settings" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 rounded-xl bg-joy-navy/10 flex items-center justify-center mb-4 group-hover:bg-joy-navy/20 transition-colors">
                <Icons.Sliders size={24} className="text-joy-navy" />
              </div>
              <h3 className="font-semibold text-joy-gray-900">Settings</h3>
              <p className="text-sm text-joy-gray-500">Store configuration</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

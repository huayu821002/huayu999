'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { adminFetch } from '@/lib/adminFetch'

interface DashboardStats {
  revenue: number
  orders: number
  customers: number
  products: number
  pending: number
  processing: number
  shipped: number
}

interface RecentOrder {
  id: string
  orderNumber: string
  customer: string
  items: number
  total: number
  status: string
  createdAt: string
}

interface TopProduct {
  id: string
  name: string
  sales: number
  revenue: string
  image: string | null
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function AdminDashboard() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])

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
    }
  }, [router])

  useEffect(() => {
    if (!isAdmin) return
    fetchDashboardData()
  }, [isAdmin])

  const fetchDashboardData = async () => {
    try {
      const res = await adminFetch('/api/admin/dashboard')
      const data = await res.json()
      if (data.success) {
        setStats(data.data.stats)
        setRecentOrders(data.data.recentOrders)
        setTopProducts(data.data.topProducts)
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hr ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Dashboard</h1>
              <p className="text-joy-gray-600">Welcome back! Here is what is happening with your store.</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-joy-gray-600 hover:text-joy-gray-900 hover:bg-joy-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-joy-green/10 flex items-center justify-center text-joy-green">
                  <Icons.DollarSign size={24} />
                </div>
              </div>
              <p className="text-2xl font-bold text-joy-gray-900 mb-1">
                ${(stats?.revenue || 0).toLocaleString()}
              </p>
              <p className="text-sm text-joy-gray-500">Revenue (30 days)</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-joy-orange/10 flex items-center justify-center text-joy-orange">
                  <Icons.Package size={24} />
                </div>
              </div>
              <p className="text-2xl font-bold text-joy-gray-900 mb-1">{stats?.orders || 0}</p>
              <p className="text-sm text-joy-gray-500">Total Orders</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-joy-pink/10 flex items-center justify-center text-joy-pink">
                  <Icons.User size={24} />
                </div>
              </div>
              <p className="text-2xl font-bold text-joy-gray-900 mb-1">{stats?.customers || 0}</p>
              <p className="text-sm text-joy-gray-500">Customers</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-joy-navy/10 flex items-center justify-center text-joy-navy">
                  <Icons.Package size={24} />
                </div>
              </div>
              <p className="text-2xl font-bold text-joy-gray-900 mb-1">{stats?.products || 0}</p>
              <p className="text-sm text-joy-gray-500">Active Products</p>
            </div>
          </div>

          {/* Order Status Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-yellow-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</p>
              <p className="text-sm text-yellow-700">Pending</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats?.processing || 0}</p>
              <p className="text-sm text-blue-700">Processing</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{stats?.shipped || 0}</p>
              <p className="text-sm text-purple-700">Shipped</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recent Orders */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm">
              <div className="p-6 border-b border-joy-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg text-joy-gray-900">Recent Orders</h2>
                  <Link href="/admin/orders" className="text-sm text-joy-orange hover:underline">
                    View All
                  </Link>
                </div>
              </div>
              {recentOrders.length === 0 ? (
                <div className="p-6 text-center text-joy-gray-500">
                  <Icons.Package size={48} className="mx-auto mb-4 opacity-30" />
                  <p>No orders yet</p>
                </div>
              ) : (
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
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-joy-gray-50 transition-colors">
                          <td className="px-6 py-4"><span className="font-mono text-sm">{order.orderNumber}</span></td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-joy-gray-900">{order.customer}</div>
                            <div className="text-xs text-joy-gray-500">{order.items} items</div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-joy-gray-900">${order.total.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                              STATUS_COLORS[order.status] || 'bg-joy-gray-100 text-joy-gray-600'
                            )}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-joy-gray-500">{formatTimeAgo(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-2xl shadow-sm">
              <div className="p-6 border-b border-joy-gray-100">
                <h2 className="font-semibold text-lg text-joy-gray-900">Recent Products</h2>
              </div>
              {topProducts.length === 0 ? (
                <div className="p-6 text-center text-joy-gray-500">
                  <Icons.Package size={48} className="mx-auto mb-4 opacity-30" />
                  <p>No products yet</p>
                </div>
              ) : (
                <div className="p-6">
                  <div className="space-y-4">
                    {topProducts.map((product, i) => (
                      <Link key={product.id} href={`/products/${product.id}`} className="flex items-center gap-4 hover:bg-joy-gray-50 -mx-2 px-2 py-2 rounded-lg transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-joy-gray-100 overflow-hidden flex-shrink-0">
                          {product.image ? (
                            <img src={product.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-joy-gray-300">
                              <Icons.Package size={20} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-joy-gray-900 truncate">{product.name}</p>
                          <p className="text-xs text-joy-gray-500">{product.sales} orders</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
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
            <Link href="/admin/banners" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 rounded-xl bg-joy-pink/10 flex items-center justify-center mb-4 group-hover:bg-joy-pink/20 transition-colors">
                <Icons.Image size={24} className="text-joy-pink" />
              </div>
              <h3 className="font-semibold text-joy-gray-900">Banners</h3>
              <p className="text-sm text-joy-gray-500">Homepage carousel</p>
            </Link>
            <Link href="/admin/seo" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 rounded-xl bg-joy-orange/10 flex items-center justify-center mb-4 group-hover:bg-joy-orange/20 transition-colors">
                <Icons.Search size={24} className="text-joy-orange" />
              </div>
              <h3 className="font-semibold text-joy-gray-900">SEO Settings</h3>
              <p className="text-sm text-joy-gray-500">Meta tags & Open Graph</p>
            </Link>
            <Link href="/admin/contacts" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 rounded-xl bg-joy-pink/10 flex items-center justify-center mb-4 group-hover:bg-joy-pink/20 transition-colors">
                <Icons.Mail size={24} className="text-joy-pink" />
              </div>
              <h3 className="font-semibold text-joy-gray-900">Contact Messages</h3>
              <p className="text-sm text-joy-gray-500">View customer inquiries</p>
            </Link>
            <Link href="/admin/subscribers" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 rounded-xl bg-joy-orange/10 flex items-center justify-center mb-4 group-hover:bg-joy-orange/20 transition-colors">
                <Icons.Mail size={24} className="text-joy-orange" />
              </div>
              <h3 className="font-semibold text-joy-gray-900">Subscribers</h3>
              <p className="text-sm text-joy-gray-500">Newsletter emails</p>
            </Link>
            <Link href="/admin/warehouses" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 rounded-xl bg-joy-blue/10 flex items-center justify-center mb-4 group-hover:bg-joy-blue/20 transition-colors">
                <Icons.MapPin size={24} className="text-joy-blue" />
              </div>
              <h3 className="font-semibold text-joy-gray-900">Warehouses</h3>
              <p className="text-sm text-joy-gray-500">Overseas warehouses</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

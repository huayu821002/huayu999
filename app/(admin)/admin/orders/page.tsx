'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { cn } from '@/lib/utils'
import { adminFetch } from '@/lib/adminFetch'

interface OrderItem {
  id?: string
  productId?: string
  name: string
  sku?: string
  price: number
  quantity: number
  image?: string
  variant?: string
}

interface Order {
  id: string
  orderNumber: string
  userId: string
  user?: { name: string; email: string }
  status: string
  items: string
  subtotal: number
  shippingCost: number
  tax: number
  discount: number
  total: number
  currency: string
  shippingAddress: string
  billingAddress?: string
  paymentMethod?: string
  paymentId?: string
  trackingNumber?: string
  trackingUrl?: string
  notes?: string
  createdAt: string
  updatedAt: string
  parsedItems?: OrderItem[]
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'PROCESSING', label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  { value: 'SHIPPED', label: 'Shipped', color: 'bg-purple-100 text-purple-700' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-700' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Order detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  
  // Update form
  const [updateStatus, setUpdateStatus] = useState('')
  const [updateTracking, setUpdateTracking] = useState('')
  const [updateTrackingUrl, setUpdateTrackingUrl] = useState('')
  const [updateNotes, setUpdateNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

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
      const res = await adminFetch('/api/admin/orders')
      const data = await res.json()
      if (data.success) setOrders(data.data)
    } catch (err) { console.error(err) } finally {
      setIsLoading(false)
    }
  }

  const openOrderDetail = async (order: Order) => {
    setIsDetailLoading(true)
    setSelectedOrder(order)
    setUpdateStatus(order.status)
    setUpdateTracking(order.trackingNumber || '')
    setUpdateTrackingUrl(order.trackingUrl || '')
    setUpdateNotes(order.notes || '')
    setIsDetailLoading(false)
  }

  const closeOrderDetail = () => {
    setSelectedOrder(null)
    setUpdateStatus('')
    setUpdateTracking('')
    setUpdateTrackingUrl('')
    setUpdateNotes('')
  }

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updateStatus,
          trackingNumber: updateTracking,
          trackingUrl: updateTrackingUrl,
          notes: updateNotes,
        }),
      })
      const data = await res.json()
      if (data.success) {
        fetchOrders()
        closeOrderDetail()
      } else {
        alert(data.error || 'Failed to update order')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to update order')
    } finally {
      setIsUpdating(false)
    }
  }

  const formatAddress = (addr: string) => {
    try {
      const parsed = JSON.parse(addr)
      return {
        name: parsed.name || '',
        street: parsed.street || '',
        city: parsed.city || '',
        state: parsed.state || '',
        zipCode: parsed.zipCode || '',
        country: parsed.country || '',
        phone: parsed.phone || '',
      }
    } catch { return null }
  }

  const parseItems = (itemsStr: string): OrderItem[] => {
    try { return JSON.parse(itemsStr) } catch { return [] }
  }

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  const filtered = orders.filter(o => {
    const matchSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  // Stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'PENDING').length,
    processing: orders.filter(o => o.status === 'PROCESSING').length,
    shipped: orders.filter(o => o.status === 'SHIPPED').length,
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Orders</h1>
              <p className="text-joy-gray-600">{orders.length} total orders</p>
            </div>
            <Link href="/admin/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <p className="text-3xl font-bold text-joy-gray-900 mb-1">{stats.total}</p>
              <p className="text-sm text-joy-gray-500">Total Orders</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <p className="text-3xl font-bold text-yellow-600 mb-1">{stats.pending}</p>
              <p className="text-sm text-joy-gray-500">Pending</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <p className="text-3xl font-bold text-blue-600 mb-1">{stats.processing}</p>
              <p className="text-sm text-joy-gray-500">Processing</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <p className="text-3xl font-bold text-purple-600 mb-1">{stats.shipped}</p>
              <p className="text-sm text-joy-gray-500">Shipped</p>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-joy-gray-100 flex gap-4 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-joy-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search by order # or customer..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none" 
                />
              </div>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)} 
                className="px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-joy-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Order</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Customer</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Date</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Items</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Total</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Tracking</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-joy-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-8 text-center text-joy-gray-500">No orders found</td></tr>
                  ) : filtered.map((order) => (
                    <tr key={order.id} className="hover:bg-joy-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-medium text-joy-orange">{order.orderNumber}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-joy-gray-600">
                        {order.user?.name || 'Guest'}
                        {order.user?.email && <span className="block text-xs text-joy-gray-400">{order.user.email}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-joy-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                        <span className="block text-xs">{new Date(order.createdAt).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-joy-gray-600">
                          {parseItems(order.items).length} items
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-joy-orange">
                        ${order.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'inline-flex px-3 py-1 rounded-full text-xs font-medium',
                          STATUS_COLORS[order.status] || 'bg-joy-gray-100 text-joy-gray-600'
                        )}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {order.trackingNumber ? (
                          <a 
                            href={order.trackingUrl || `#`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-joy-orange hover:underline font-mono"
                          >
                            {order.trackingNumber}
                          </a>
                        ) : (
                          <span className="text-sm text-joy-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => openOrderDetail(order)}
                        >
                          View / Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeOrderDetail} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-joy-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-display text-xl font-bold text-joy-gray-900">
                  Order {selectedOrder.orderNumber}
                </h2>
                <p className="text-sm text-joy-gray-500">
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <button onClick={closeOrderDetail} className="p-2 hover:bg-joy-gray-100 rounded-lg">
                <Icons.X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Actions */}
              <div className="bg-joy-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-joy-gray-900 mb-4">Order Status & Actions</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Status</label>
                    <select 
                      value={updateStatus} 
                      onChange={(e) => setUpdateStatus(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Tracking Number</label>
                    <input 
                      type="text" 
                      value={updateTracking} 
                      onChange={(e) => setUpdateTracking(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Tracking URL</label>
                    <input 
                      type="url" 
                      value={updateTrackingUrl} 
                      onChange={(e) => setUpdateTrackingUrl(e.target.value)}
                      placeholder="https://track.example.com/..."
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Admin Notes</label>
                    <textarea 
                      value={updateNotes} 
                      onChange={(e) => setUpdateNotes(e.target.value)}
                      placeholder="Internal notes (not shown to customer)"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleUpdateOrder} isLoading={isUpdating}>
                    Update Order
                  </Button>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold text-joy-gray-900 mb-4">Order Items</h3>
                <div className="border border-joy-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-joy-gray-50">
                      <tr>
                        <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Product</th>
                        <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">SKU</th>
                        <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Price</th>
                        <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Qty</th>
                        <th className="text-right text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-joy-gray-100">
                      {parseItems(selectedOrder.items).map((item, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {item.image && (
                                <div className="w-12 h-12 rounded-lg bg-joy-gray-100 overflow-hidden flex-shrink-0">
                                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-joy-gray-900 line-clamp-1">{item.name}</p>
                                {item.variant && <p className="text-xs text-joy-gray-500">{item.variant}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-joy-gray-500 font-mono">{item.sku || '-'}</td>
                          <td className="px-4 py-3 text-joy-gray-600">${item.price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-joy-gray-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-semibold text-joy-orange">
                            ${(item.price * item.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Order Summary */}
                <div className="mt-4 flex justify-end">
                  <div className="w-64 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-joy-gray-500">Subtotal</span>
                      <span className="font-medium">${selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-joy-gray-500">Shipping</span>
                      <span className="font-medium">${selectedOrder.shippingCost.toFixed(2)}</span>
                    </div>
                    {selectedOrder.tax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-joy-gray-500">Tax</span>
                        <span className="font-medium">${selectedOrder.tax.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-joy-green">
                        <span>Discount</span>
                        <span>-${selectedOrder.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t border-joy-gray-200 pt-2">
                      <span>Total</span>
                      <span className="text-joy-orange">${selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {(() => {
                const addr = formatAddress(selectedOrder.shippingAddress)
                return addr ? (
                  <div>
                    <h3 className="font-semibold text-joy-gray-900 mb-4">Shipping Address</h3>
                    <div className="bg-joy-gray-50 rounded-xl p-4">
                      <p className="font-medium text-joy-gray-900">{addr.name}</p>
                      <p className="text-sm text-joy-gray-600">{addr.street}</p>
                      <p className="text-sm text-joy-gray-600">{addr.city}, {addr.state} {addr.zipCode}</p>
                      <p className="text-sm text-joy-gray-600">{addr.country}</p>
                      {addr.phone && <p className="text-sm text-joy-gray-500 mt-2">Phone: {addr.phone}</p>}
                    </div>
                  </div>
                ) : null
              })()}

              {/* Payment Info */}
              <div>
                <h3 className="font-semibold text-joy-gray-900 mb-4">Payment Information</h3>
                <div className="bg-joy-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-joy-gray-500">Method</span>
                    <span className="font-medium">{selectedOrder.paymentMethod || 'N/A'}</span>
                  </div>
                  {selectedOrder.paymentId && (
                    <div className="flex justify-between">
                      <span className="text-joy-gray-500">Payment ID</span>
                      <span className="font-mono text-sm">{selectedOrder.paymentId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-joy-gray-500">Currency</span>
                    <span className="font-medium">{selectedOrder.currency}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-joy-gray-100 px-6 py-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={closeOrderDetail}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

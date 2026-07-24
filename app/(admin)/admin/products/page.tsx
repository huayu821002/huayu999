'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const PRODUCTS = [
  { id: '1', name: 'Yiwu Crystal Beaded Necklace', sku: 'AC-001', price: 12.99, inventory: 150, status: 'Active', category: 'Accessories', isTrending: true },
  { id: '2', name: 'Pet Collar with LED Light', sku: 'PET-002', price: 15.99, inventory: 200, status: 'Active', category: 'Pet Supplies', isTrending: true },
  { id: '3', name: 'Nordic Desk Organizer', sku: 'HOME-003', price: 28.99, inventory: 80, status: 'Active', category: 'Home Decor', isTrending: false },
  { id: '4', name: 'LED Message Board', sku: 'GIFT-004', price: 19.99, inventory: 120, status: 'Active', category: 'Gifts', isTrending: true },
  { id: '5', name: 'Ceramic Vase Set', sku: 'HOME-005', price: 34.99, inventory: 60, status: 'Draft', category: 'Home Decor', isTrending: false },
  { id: '6', name: 'Pet Carrier Backpack', sku: 'PET-006', price: 45.99, inventory: 45, status: 'Active', category: 'Pet Supplies', isTrending: false },
]

const ORDERS = [
  { id: '1', orderNumber: 'JH-LX4K2M-AB7C', customer: 'Maria Santos', items: 12, total: 459.99, status: 'Processing', date: '2024-01-15' },
  { id: '2', orderNumber: 'JH-K9J3N8-CD5E', customer: 'John Smith', items: 5, total: 189.50, status: 'Shipped', date: '2024-01-15' },
  { id: '3', orderNumber: 'JH-M2P7Q4-EF9G', customer: 'Ana Rodriguez', items: 23, total: 892.00, status: 'Pending', date: '2024-01-14' },
  { id: '4', orderNumber: 'JH-N5R1T6-GH2I', customer: 'Carlos Mendez', items: 8, total: 267.75, status: 'Delivered', date: '2024-01-14' },
]

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-joy-green/10 text-joy-green',
  Draft: 'bg-joy-gray-100 text-joy-gray-600',
  Processing: 'bg-joy-orange/10 text-joy-orange',
  Shipped: 'bg-joy-navy/10 text-joy-navy',
  Pending: 'bg-yellow-100 text-yellow-700',
  Delivered: 'bg-joy-green/10 text-joy-green',
}

export default function AdminProductsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

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

  const filteredProducts = PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredOrders = ORDERS.filter(o =>
    o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Products and Orders</h1>
              <p className="text-joy-gray-600">Manage your products and orders</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard">
                <Button variant="secondary">Back to Dashboard</Button>
              </Link>
              <Button onClick={() => setShowAddModal(true)}>
                <Icons.Plus size={18} className="mr-2" />
                Add Product
              </Button>
            </div>
          </div>
          <div className="flex border-b border-joy-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-6 py-4 font-medium text-sm border-b-2 -mb-px transition-colors ${
                activeTab === 'products' ? 'text-joy-orange border-joy-orange' : 'text-joy-gray-500 border-transparent hover:text-joy-gray-700'
              }`}
            >
              <Icons.Package size={18} className="inline mr-2" />
              Products ({PRODUCTS.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-4 font-medium text-sm border-b-2 -mb-px transition-colors ${
                activeTab === 'orders' ? 'text-joy-orange border-joy-orange' : 'text-joy-gray-500 border-transparent hover:text-joy-gray-700'
              }`}
            >
              <Icons.ShoppingCart size={18} className="inline mr-2" />
              Orders ({ORDERS.length})
            </button>
          </div>
          <div className="mb-6">
            <div className="relative max-w-md">
              <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-joy-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none focus:ring-2 focus:ring-joy-orange/20"
              />
            </div>
          </div>
          {activeTab === 'products' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-joy-gray-50">
                    <tr>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Product</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">SKU</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Price</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Stock</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-joy-gray-100">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-joy-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-joy-gray-100 overflow-hidden flex-shrink-0">
                              <img src={`https://picsum.photos/seed/${product.id}/100/100`} alt={product.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-medium text-joy-gray-900">{product.name}</p>
                              <p className="text-xs text-joy-gray-500">{product.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-joy-gray-600">{product.sku}</td>
                        <td className="px-6 py-4 font-semibold text-joy-orange">${product.price.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`font-medium ${product.inventory < 20 ? 'text-red-500' : 'text-joy-gray-700'}`}>{product.inventory}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[product.status]}`}>{product.status}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-joy-gray-100 rounded-lg transition-colors"><Icons.Eye size={18} className="text-joy-gray-500" /></button>
                            <button className="p-2 hover:bg-joy-gray-100 rounded-lg transition-colors"><Icons.Copy size={18} className="text-joy-gray-500" /></button>
                            <button className="p-2 hover:bg-red-50 rounded-lg transition-colors"><Icons.Trash2 size={18} className="text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-joy-gray-50">
                    <tr>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Order</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Customer</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Items</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Total</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-joy-gray-100">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-joy-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm font-medium text-joy-gray-900">{order.orderNumber}</td>
                        <td className="px-6 py-4"><p className="font-medium text-joy-gray-900">{order.customer}</p></td>
                        <td className="px-6 py-4 text-joy-gray-600">{order.items}</td>
                        <td className="px-6 py-4 font-semibold text-joy-orange">${order.total.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-joy-gray-500">{order.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-joy-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-joy-gray-900">Add New Product</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="Product Name" placeholder="Enter product name" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="SKU" placeholder="e.g., AC-001" />
                <Input label="Barcode" placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Price (USD)" type="number" placeholder="0.00" />
                <Input label="Compare At Price" type="number" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Cost Price" type="number" placeholder="0.00" />
                <Input label="Inventory" type="number" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">Category</label>
                <select className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none">
                  <option>Accessories</option><option>Pet Supplies</option><option>Gifts</option><option>Home Decor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">Description</label>
                <textarea className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none min-h-[100px]" placeholder="Enter product description..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">Product Images</label>
                <div className="border-2 border-dashed border-joy-gray-200 rounded-xl p-8 text-center">
                  <Icons.Package size={48} className="mx-auto text-joy-gray-300 mb-4" />
                  <p className="text-joy-gray-600 mb-2">Drag and drop images here, or click to upload</p>
                  <Button variant="secondary" size="sm">Upload Images</Button>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-joy-gray-100 px-6 py-4 flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button>Save Product</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

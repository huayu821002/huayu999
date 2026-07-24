'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Product {
  id: string
  name: string
  slug: string
  sku: string
  price: number
  inventory: number
  isActive: boolean
  isFeatured: boolean
  isTrending: boolean
  category?: { name: string }
}

interface Category {
  id: string
  name: string
  slug: string
}

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-joy-green/10 text-joy-green',
  Draft: 'bg-joy-gray-100 text-joy-gray-600',
}

export default function AdminProductsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '', sku: '', description: '', shortDesc: '', price: '', comparePrice: '',
    costPrice: '', wholesalePrice: '', vipPrice: '', minOrderQty: '1',
    inventory: '0', lowStockAlert: '10', categoryId: '', images: '',
    isActive: true, isFeatured: false, isTrending: false,
  })

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
    fetchProducts()
    fetchCategories()
  }, [isAdmin])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/admin/products')
      const data = await res.json()
      if (data.success) setProducts(data.data)
    } catch (err) { console.error(err) }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      if (data.success) setCategories(data.data)
    } catch (err) { console.error(err) }
  }

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddProduct = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        fetchProducts()
        setFormData({ name: '', sku: '', description: '', shortDesc: '', price: '', comparePrice: '', costPrice: '', wholesalePrice: '', vipPrice: '', minOrderQty: '1', inventory: '0', lowStockAlert: '10', categoryId: '', images: '', isActive: true, isFeatured: false, isTrending: false })
      } else {
        alert(data.error)
      }
    } catch (err) { alert('Failed to add product') }
    setIsSaving(false)
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Products</h1>
              <p className="text-joy-gray-600">{products.length} products</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
              <Button onClick={() => setShowAddModal(true)}><Icons.Plus size={18} className="mr-2" />Add Product</Button>
            </div>
          </div>
          <div className="mb-6">
            <div className="relative max-w-md">
              <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-joy-gray-400" />
              <input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none" />
            </div>
          </div>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-joy-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-joy-gray-500">No products found</td></tr>
                  ) : filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-joy-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-joy-gray-100 flex items-center justify-center text-joy-gray-400"><Icons.Package size={20} /></div>
                          <div>
                            <p className="font-medium text-joy-gray-900">{product.name}</p>
                            <p className="text-xs text-joy-gray-500">{product.category?.name || 'Uncategorized'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-joy-gray-600">{product.sku}</td>
                      <td className="px-6 py-4 font-semibold text-joy-orange">${product.price.toFixed(2)}</td>
                      <td className="px-6 py-4"><span className={`font-medium ${product.inventory < 20 ? 'text-red-500' : 'text-joy-gray-700'}`}>{product.inventory}</span></td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${product.isActive ? STATUS_COLORS.Active : STATUS_COLORS.Draft}`}>{product.isActive ? 'Active' : 'Draft'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
              <Input label="Product Name *" placeholder="Enter product name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="SKU *" placeholder="e.g., AC-001" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
                <div><label className="block text-sm font-medium text-joy-gray-700 mb-2">Category</label><select className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none" value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: e.target.value})}><option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Price (USD) *" type="number" placeholder="0.00" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                <Input label="Compare At Price" type="number" placeholder="0.00" value={formData.comparePrice} onChange={(e) => setFormData({...formData, comparePrice: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Cost Price" type="number" placeholder="0.00" value={formData.costPrice} onChange={(e) => setFormData({...formData, costPrice: e.target.value})} />
                <Input label="Wholesale Price" type="number" placeholder="0.00" value={formData.wholesalePrice} onChange={(e) => setFormData({...formData, wholesalePrice: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="VIP Price" type="number" placeholder="0.00" value={formData.vipPrice} onChange={(e) => setFormData({...formData, vipPrice: e.target.value})} />
                <Input label="Min Order Qty" type="number" placeholder="1" value={formData.minOrderQty} onChange={(e) => setFormData({...formData, minOrderQty: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Inventory *" type="number" placeholder="0" value={formData.inventory} onChange={(e) => setFormData({...formData, inventory: e.target.value})} />
                <Input label="Low Stock Alert" type="number" placeholder="10" value={formData.lowStockAlert} onChange={(e) => setFormData({...formData, lowStockAlert: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">Description *</label>
                <textarea className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none min-h-[100px]" placeholder="Enter product description..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({...formData, isActive: e.target.checked})} className="rounded border-joy-gray-300" /><span className="text-sm text-joy-gray-700">Active</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData({...formData, isFeatured: e.target.checked})} className="rounded border-joy-gray-300" /><span className="text-sm text-joy-gray-700">Featured</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isTrending} onChange={(e) => setFormData({...formData, isTrending: e.target.checked})} className="rounded border-joy-gray-300" /><span className="text-sm text-joy-gray-700">Trending</span></label>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-joy-gray-100 px-6 py-4 flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button onClick={handleAddProduct} isLoading={isSaving}>Save Product</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

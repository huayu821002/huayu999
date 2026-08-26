'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { adminFetch } from '@/lib/adminFetch'

interface Variant {
  id: string
  productId: string
  name: string
  value: string
  sku: string | null
  price: number | null
  inventory: number
  image: string | null
}

interface Product {
  id: string
  name: string
  slug: string
  sku: string
  price: number
  comparePrice: number | null
  costPrice: number | null
  wholesalePrice: number | null
  vipPrice: number | null
  minOrderQty: number
  inventory: number
  lowStockAlert: number
  weight: number | null
  description: string
  shortDesc: string | null
  images: string
  modelImage: string | null
  categoryId: string | null
  category: { id: string; name: string } | null
  isActive: boolean
  isFeatured: boolean
  isTrending: boolean
  tags: string | null
  createdAt: string
}

interface Category {
  id: string
  name: string
  slug: string
}

export default function AdminProductsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showVariantPanel, setShowVariantPanel] = useState(false)
  const [productVariants, setProductVariants] = useState<Variant[]>([])
  const [variantForm, setVariantForm] = useState({ name: '', value: '', sku: '', price: '', inventory: '0' })
  const [isSaving, setIsSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', sku: '', description: '', shortDesc: '', price: '', comparePrice: '',
    costPrice: '', wholesalePrice: '', vipPrice: '', minOrderQty: '1',
    inventory: '0', lowStockAlert: '10', weight: '', categoryId: '', images: '',
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
      const res = await adminFetch('/api/admin/products')
      const data = await res.json()
      if (data.success) setProducts(data.data)
    } catch (err) { console.error(err) }
  }

  const fetchCategories = async () => {
    try {
      const res = await adminFetch('/api/admin/categories')
      const data = await res.json()
      if (data.success) setCategories(data.data)
    } catch (err) { console.error(err) }
  }

  const fetchVariants = async (productId: string) => {
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/variants`)
      const data = await res.json()
      if (data.success) setProductVariants(data.data)
    } catch (err) { console.error(err) }
  }

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openAdd = () => {
    setEditingProduct(null)
    setProductVariants([])
    setForm({ name: '', sku: '', description: '', shortDesc: '', price: '', comparePrice: '', costPrice: '', wholesalePrice: '', vipPrice: '', minOrderQty: '1', inventory: '0', lowStockAlert: '10', weight: '', categoryId: '', images: '', isActive: true, isFeatured: false, isTrending: false })
    setShowProductModal(true)
  }


  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setProductVariants([])
    setForm({
      name: product.name, sku: product.sku, description: product.description, shortDesc: product.shortDesc || '',
      price: String(product.price), comparePrice: product.comparePrice ? String(product.comparePrice) : '',
      costPrice: product.costPrice ? String(product.costPrice) : '', wholesalePrice: product.wholesalePrice ? String(product.wholesalePrice) : '',
      vipPrice: product.vipPrice ? String(product.vipPrice) : '', minOrderQty: String(product.minOrderQty),
      inventory: String(product.inventory), lowStockAlert: String(product.lowStockAlert), weight: product.weight ? String(product.weight) : '',
      categoryId: product.categoryId || '', images: product.images,
      isActive: product.isActive, isFeatured: product.isFeatured, isTrending: product.isTrending,
    })
    setShowProductModal(true)
    fetchVariants(product.id)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return
    try {
      const res = await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' })
      if (res.ok) fetchProducts()
      else alert('Failed to delete product')
    } catch { alert('Failed to delete product') }
  }

  const handleProductSubmit = async () => {
    setIsSaving(true)
    try {
      const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : '/api/admin/products'
      const method = editingProduct ? 'PUT' : 'POST'
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setShowProductModal(false)
        fetchProducts()
      } else {
        alert(data.error || 'Failed to save product')
      }
    } catch { alert('Failed to save product') }
    setIsSaving(false)
  }

  const handleAddVariant = async () => {
    if (!editingProduct || !variantForm.name || !variantForm.value) return
    setIsSaving(true)
    try {
      const res = await adminFetch(`/api/admin/products/${editingProduct.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variantForm),
      })
      const data = await res.json()
      if (data.success) {
        setVariantForm({ name: '', value: '', sku: '', price: '', inventory: '0' })
        fetchVariants(editingProduct.id)
      } else {
        alert(data.error)
      }
    } catch { alert('Failed to add variant') }
    setIsSaving(false)
  }

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm('Delete this variant?')) return
    try {
      await adminFetch(`/api/admin/products/${editingProduct!.id}/variants/${variantId}`, { method: 'DELETE' })
      fetchVariants(editingProduct!.id)
    } catch { alert('Failed to delete variant') }
  }

  const parseImages = (imgStr: string): string[] => {
    if (!imgStr) return []
    try { 
      const parsed = JSON.parse(imgStr)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch { 
      // Legacy comma-separated fallback
      return imgStr.split(',').map(s => s.trim()).filter(Boolean)
    }
  }

  const addImage = (url: string, index: number) => {
    const currentImages = parseImages(form.images)
    // Ensure array has at least index+1 slots (max 5)
    while (currentImages.length < index + 1) {
      currentImages.push('')
    }
    // Cap at 5 slots
    if (index < 5) {
      currentImages[index] = url
    }
    // Keep all slots (including empty) to preserve index positions
    setForm({...form, images: JSON.stringify(currentImages.slice(0, 5))})
  }

  const removeImage = (index: number) => {
    const currentImages = parseImages(form.images)
    // Set to empty string instead of splicing to preserve slot positions
    if (index < currentImages.length) {
      currentImages[index] = ''
    }
    setForm({...form, images: JSON.stringify(currentImages.slice(0, 5))})
  }

  const COMMON_ATTRIBUTES = ['Color', 'Size', 'Material', 'Style', 'Weight', 'Dimensions']

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
              <input type="file" accept=".csv" id="csvImport" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const formData = new FormData()
                formData.append('file', file)
                try {
                  const res = await adminFetch('/api/admin/products/import', { method: 'POST', body: formData })
                  const data = await res.json()
                  if (data.success !== undefined) {
                    alert(`Imported: ${data.success}, Failed: ${data.failed}\n${data.errors?.slice(0,3).join('\n') || ''}`)
                    fetchProducts()
                  } else {
                    alert(data.error || 'Import failed')
                  }
                } catch { alert('Import failed') }
                e.target.value = ''
              }} />
              <label htmlFor="csvImport" className="cursor-pointer inline-flex items-center justify-center rounded-xl border-2 border-joy-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-joy-gray-700 hover:bg-joy-gray-50 transition-colors">
                <Icons.Package size={18} className="mr-2" />Import CSV
              </label>
              <Button variant="secondary" onClick={() => window.open('/api/admin/products/import', '_blank')}><Icons.Download size={18} className="mr-2" />Export CSV</Button>
              <Button variant="secondary" onClick={() => router.push('/admin/products/import')}><Icons.ExternalLink size={18} className="mr-2" />Import URLs</Button>
              <Button onClick={openAdd}><Icons.Plus size={18} className="mr-2" />Add Product</Button>
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
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-joy-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-joy-gray-500">No products found</td></tr>
                  ) : filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-joy-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-joy-gray-100 overflow-hidden flex-shrink-0">
                            {parseImages(product.images)[0] ? (
                              <img src={parseImages(product.images)[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-joy-gray-300"><Icons.Package size={20} /></div>
                            )}
                          </div>
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
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(product)} className="p-2 hover:bg-joy-gray-100 rounded-lg" title="Edit"><Icons.Copy size={18} className="text-joy-gray-500" /></button>
                          <button onClick={() => handleDelete(product.id)} className="p-2 hover:bg-red-50 rounded-lg" title="Delete"><Icons.Trash2 size={18} className="text-red-500" /></button>
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

      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowProductModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-joy-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-display text-xl font-bold text-joy-gray-900">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <div className="flex items-center gap-2">
                {editingProduct && (
                  <Button variant="secondary" size="sm" onClick={() => setShowVariantPanel(!showVariantPanel)}>
                    {showVariantPanel ? 'Hide Variants' : `Variants (${productVariants.length})`}
                  </Button>
                )}
                <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
              </div>
            </div>

            <div className="flex">
              {/* Main Form */}
              <div className="flex-1 p-6 space-y-4">
                <Input label="Product Name *" placeholder="Enter product name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="SKU *" placeholder="e.g., AC-001" value={form.sku} onChange={(e) => setForm({...form, sku: e.target.value})} />
                  <div><label className="block text-sm font-medium text-joy-gray-700 mb-2">Category</label><select className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none" value={form.categoryId} onChange={(e) => setForm({...form, categoryId: e.target.value})}><option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Price (USD) *" type="number" placeholder="0.00" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} />
                  <Input label="Compare At Price" type="number" placeholder="0.00" value={form.comparePrice} onChange={(e) => setForm({...form, comparePrice: e.target.value})} />
                  <Input label="Wholesale Price" type="number" placeholder="0.00" value={form.wholesalePrice} onChange={(e) => setForm({...form, wholesalePrice: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="VIP Price" type="number" placeholder="0.00" value={form.vipPrice} onChange={(e) => setForm({...form, vipPrice: e.target.value})} />
                  <Input label="Cost Price" type="number" placeholder="0.00" value={form.costPrice} onChange={(e) => setForm({...form, costPrice: e.target.value})} />
                  <Input label="Min Order Qty" type="number" placeholder="1" value={form.minOrderQty} onChange={(e) => setForm({...form, minOrderQty: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Inventory *" type="number" placeholder="0" value={form.inventory} onChange={(e) => setForm({...form, inventory: e.target.value})} />
                  <Input label="Low Stock Alert" type="number" placeholder="10" value={form.lowStockAlert} onChange={(e) => setForm({...form, lowStockAlert: e.target.value})} />
                  <Input label="Weight (kg)" type="number" step="0.01" placeholder="0.5" value={form.weight || ''} onChange={(e) => setForm({...form, weight: e.target.value})} />
                </div>
                {/* Product Images - Multi Upload */}
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-2">Product Images (up to 5)</label>
                  <div className="grid grid-cols-5 gap-3 mb-3">
                    {[0, 1, 2, 3, 4].map(i => {
                      const currentImages = parseImages(form.images)
                      const img = currentImages[i]
                      return (
                        <div key={i} className="aspect-square rounded-xl border-2 border-dashed border-joy-gray-200 overflow-hidden relative bg-joy-gray-50">
                          {img ? (
                            <>
                              <img src={img} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeImage(i)}
                                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                              >×</button>
                            </>
                          ) : (
                            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-joy-gray-100">
                              <Icons.Plus size={20} className="text-joy-gray-400" />
                              <span className="text-xs text-joy-gray-400 mt-1">Image {i + 1}</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  const uploadFormData = new FormData()
                                  uploadFormData.append('file', file)
                                  try {
                                    const res = await adminFetch('/api/upload', { method: 'POST', body: uploadFormData })
                                    const data = await res.json()
                                    if (data.success) {
                                      addImage(data.url, i)
                                    }
                                  } catch { console.error('Upload failed') }
                                  e.target.value = ''
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-joy-gray-500">Click each box to upload. First image will be the main product image.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-2">Description *</label>
                  <textarea className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none min-h-[100px]" placeholder="Full description..." value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
                </div>
                <Input label="Short Description" placeholder="Brief description" value={form.shortDesc} onChange={(e) => setForm({...form, shortDesc: e.target.value})} />
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({...form, isActive: e.target.checked})} className="rounded border-joy-gray-300" /><span className="text-sm text-joy-gray-700">Active</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({...form, isFeatured: e.target.checked})} className="rounded border-joy-gray-300" /><span className="text-sm text-joy-gray-700">Featured</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isTrending} onChange={(e) => setForm({...form, isTrending: e.target.checked})} className="rounded border-joy-gray-300" /><span className="text-sm text-joy-gray-700">Trending</span></label>
                </div>
              </div>

              {/* Variants Panel */}
              {showVariantPanel && editingProduct && (
                <div className="w-80 border-l border-joy-gray-100 p-4 bg-joy-gray-50 overflow-auto">
                  <h3 className="font-semibold text-joy-gray-900 mb-4">Product Variants</h3>
                  
                  {/* Add Variant Form */}
                  <div className="bg-white rounded-xl p-4 mb-4 space-y-3">
                    <p className="text-sm font-medium text-joy-gray-700">Add Variant</p>
                    <select className="w-full px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={variantForm.name} onChange={(e) => setVariantForm({...variantForm, name: e.target.value})}>
                      <option value="">Select attribute</option>
                      {COMMON_ATTRIBUTES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <Input placeholder="Value (e.g., Red, XL)" value={variantForm.value} onChange={(e) => setVariantForm({...variantForm, value: e.target.value})} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Variant SKU" value={variantForm.sku} onChange={(e) => setVariantForm({...variantForm, sku: e.target.value})} />
                      <Input placeholder="Variant Price" type="number" value={variantForm.price} onChange={(e) => setVariantForm({...variantForm, price: e.target.value})} />
                    </div>
                    <Input placeholder="Inventory" type="number" value={variantForm.inventory} onChange={(e) => setVariantForm({...variantForm, inventory: e.target.value})} />
                    <Button size="sm" className="w-full" onClick={handleAddVariant} isLoading={isSaving} disabled={!variantForm.name || !variantForm.value}>Add Variant</Button>
                  </div>

                  {/* Variant List */}
                  <div className="space-y-2">
                    {productVariants.length === 0 ? (
                      <p className="text-sm text-joy-gray-400 text-center py-4">No variants yet</p>
                    ) : productVariants.map(v => (
                      <div key={v.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-joy-gray-900">{v.value}</p>
                          <p className="text-xs text-joy-gray-500">{v.name} {v.price ? `| $${v.price}` : ''} | Stock: {v.inventory}</p>
                        </div>
                        <button onClick={() => handleDeleteVariant(v.id)} className="p-1 hover:bg-red-50 rounded"><Icons.Trash2 size={14} className="text-red-500" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-joy-gray-100 px-6 py-4 flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowProductModal(false)}>Cancel</Button>
              <Button onClick={handleProductSubmit} isLoading={isSaving}>{editingProduct ? 'Update Product' : 'Save Product'}</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

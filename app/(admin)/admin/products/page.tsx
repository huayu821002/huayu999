'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { adminFetch } from '@/lib/adminFetch'

interface Variant {
  id: string
  productId?: string
  name: string
  value: string
  sku: string | null
  price: number | null
  inventory: number | null
  image: string | null
  /** 维度明细：[{name:'颜色', value:'红色'}] —— 前台靠它拆多行选择器 */
  specs?: Array<{ name: string; value: string }>
}

interface VariantDim {
  name: string
  kind?: string
  values?: string[]
}

interface Product {
  id: string
  name: string
  slug: string
  sku: string
  price: number
  comparePrice: number | null
  costPrice: number | null
  tieredPricing: string | null
  minOrderQty: number
  inventory: number
  lowStockAlert: number
  weight: number | null
  description: string
  shortDesc: string | null
  images: string
  modelImage: string | null
  categoryIds?: string | null
  categories?: { id: string; name: string }[]
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
  parentId?: string | null
}

// Build tree structure from flat category list
function buildCategoryTree(categories: Category[]) {
  const map = new Map<string, Category & { children: Category[] }>()
  const roots: (Category & { children: Category[] })[] = []
  categories.forEach(c => map.set(c.id, { ...c, children: [] }))
  map.forEach(cat => {
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(cat)
    } else {
      roots.push(cat)
    }
  })
  return roots
}

// Helper to parse categoryIds from Product (which stores as JSON string)
function parseCategoryIds(categoryIds: string | string[] | null | undefined): string[] {
  if (!categoryIds) return []
  if (Array.isArray(categoryIds)) return categoryIds
  try { return JSON.parse(categoryIds) } catch { return [] }
}

// Render checkbox tree
function renderCategoryCheckbox(
  cat: Category & { children: Category[] },
  selectedIds: string[],
  onChange: (ids: string[]) => void,
  depth = 0
) {
  const isSelected = selectedIds.includes(cat.id)
  const toggle = () => {
    if (isSelected) {
      onChange(selectedIds.filter(id => id !== cat.id))
    } else {
      onChange([...selectedIds, cat.id])
    }
  }
  const children = cat.children || []
  return (
    <div key={cat.id} style={{ marginLeft: depth * 16 }}>
      <label className="flex items-center gap-2 py-1 cursor-pointer hover:bg-joy-gray-50 rounded px-2">
        <input type="checkbox" checked={isSelected} onChange={toggle} className="w-4 h-4" />
        <span className="text-sm">{cat.name}</span>
      </label>
      {(children as (Category & { children: Category[] })[]).map(child => renderCategoryCheckbox(child, selectedIds, onChange, depth + 1))}
    </div>
  )
}

export default function AdminProductsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [warehouseInventory, setWarehouseInventory] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showVariantPanel, setShowVariantPanel] = useState(false)
  const [productVariants, setProductVariants] = useState<Variant[]>([])
  // 批量选择 / 批量删除
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  // ★ 批量操作弹窗（2026-10-28）：inventory=加库存 / price=改价 / rename=改名
  const [batchOp, setBatchOp] = useState<'inventory' | 'price' | 'rename' | null>(null)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchForm, setBatchForm] = useState({
    invMode: 'add' as 'add' | 'set',
    invValue: 100,
    invScope: 'both' as 'variant' | 'product' | 'both',
    priceMode: 'percent' as 'percent' | 'set',
    priceValue: 10,
    priceScope: 'both' as 'variant' | 'product' | 'both',
    alsoCompare: false,
    digits: 4,
    sep: ' ',
    prefix: '',
    renameScope: 'variant' as 'variant' | 'product' | 'both',
  })
  const [variantDims, setVariantDims] = useState<VariantDim[]>([])
  const [variantForm, setVariantForm] = useState({ name: '', value: '', sku: '', price: '', inventory: '', image: '' })
  const [isSaving, setIsSaving] = useState(false)

  // 「从采集品复制变体」相关
  const [showCopyPanel, setShowCopyPanel] = useState(false)
  const [supplierList, setSupplierList] = useState<any[]>([])
  const [supplierLoading, setSupplierLoading] = useState(false)
  const [copying, setCopying] = useState(false)
  // 「一键转英文」相关
  const [translating, setTranslating] = useState(false)
  // 变体内联编辑
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [variantEdit, setVariantEdit] = useState({ value: '', price: '', inventory: '', sku: '' })

  const [form, setForm] = useState<{
    name: string; sku: string; description: string; shortDesc: string; price: string; comparePrice: string;
    costPrice: string; minOrderQty: string;
    inventory: string; lowStockAlert: string; weight: string; categoryIds: string[]; images: string;
    isActive: boolean; isFeatured: boolean; isTrending: boolean; tieredPricing: string;
  }>({
    name: '', sku: '', description: '', shortDesc: '', price: '', comparePrice: '',
    costPrice: '', minOrderQty: '1',
    inventory: '0', lowStockAlert: '10', weight: '', categoryIds: [], images: '',
    isActive: true, isFeatured: false, isTrending: false, tieredPricing: '',
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
    fetchWarehouses()
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

  const fetchWarehouses = async () => {
    try {
      const res = await adminFetch('/api/admin/warehouses')
      const data = await res.json()
      if (data.success) setWarehouses(data.data.filter((w: any) => w.isActive))
    } catch (err) { console.error(err) }
  }

  const fetchWarehouseInventory = async (productId: string) => {
    try {
      const res = await adminFetch(`/api/admin/product-inventory?productId=${productId}`)
      const data = await res.json()
      if (data.success && data.data) {
        const invMap: Record<string, string> = {}
        data.data.forEach((inv: any) => {
          invMap[inv.warehouseId] = String(inv.quantity)
        })
        setWarehouseInventory(invMap)
        const total = Object.values(invMap).reduce((sum: number, qty: string) => sum + (parseInt(qty) || 0), 0)
        setForm((prev: any) => ({...prev, inventory: String(total)}))
      }
    } catch (err) { console.error(err) }
  }

  const fetchVariants = async (productId: string) => {
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/variants`)
      const data = await res.json()
      if (data.success) {
        setProductVariants(data.data || [])
        setVariantDims(Array.isArray(data.dims) ? data.dims : [])
      }
    } catch (err) { console.error(err) }
  }

  /** 拉采集品列表（复制变体用） */
  const fetchSupplierList = async () => {
    setSupplierLoading(true)
    try {
      const res = await adminFetch('/api/admin/supplier-products/options?limit=50')
      const data = await res.json()
      if (data.success) setSupplierList(data.data || [])
    } catch (err) { console.error(err) }
    setSupplierLoading(false)
  }

  /** 变体落库：新建时（无 id）先在本地存着，保存商品后补 PUT */
  const persistVariants = async (productId: string, list: Variant[]) => {
    const res = await adminFetch(`/api/admin/products/${productId}/variants`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variants: list }),
    })
    const data = await res.json()
    if (data.success) {
      setProductVariants(data.data || [])
      fetchVariants(productId)
    }
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
    setVariantDims([])
    setShowVariantPanel(false)
    setShowCopyPanel(false)
    setEditingVariantId(null)
    setWarehouseInventory({})
    setForm({ name: '', sku: '', description: '', shortDesc: '', price: '', comparePrice: '', costPrice: '', minOrderQty: '1', inventory: '0', lowStockAlert: '10', weight: '', categoryIds: [], images: '', isActive: true, isFeatured: false, isTrending: false, tieredPricing: '' })
    setShowProductModal(true)
  }


  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setProductVariants([])
    setVariantDims([])
    setShowVariantPanel(false)
    setShowCopyPanel(false)
    setEditingVariantId(null)
    setWarehouseInventory({})
    setForm({
      name: product.name, sku: product.sku, description: product.description, shortDesc: product.shortDesc || '',
      price: String(product.price), comparePrice: product.comparePrice ? String(product.comparePrice) : '',
      costPrice: product.costPrice ? String(product.costPrice) : '', minOrderQty: String(product.minOrderQty),
      inventory: String(product.inventory), lowStockAlert: String(product.lowStockAlert), weight: product.weight ? String(product.weight) : '',
      categoryIds: product.categoryIds ? JSON.parse(product.categoryIds) : [], images: product.images,
      isActive: product.isActive, isFeatured: product.isFeatured, isTrending: product.isTrending,
      tieredPricing: product.tieredPricing || '',
    })
    setShowProductModal(true)
    fetchVariants(product.id)
    fetchWarehouseInventory(product.id)
  }

  /** 单个勾选/取消 */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  /** 全选/取消全选（只针对当前筛选结果） */
  const toggleSelectAll = () => {
    const ids = filteredProducts.map(p => p.id)
    const allSelected = ids.length > 0 && ids.every(id => selectedIds.includes(id))
    setSelectedIds(allSelected ? [] : ids)
  }

  /** 批量删除 */
  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`确定删除选中的 ${selectedIds.length} 个商品？\n\n此操作不可撤销。`)) return
    setIsBatchDeleting(true)
    try {
      const res = await adminFetch('/api/admin/products/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      const data = await res.json()
      if (data.deleted > 0) {
        setSelectedIds([])
        fetchProducts()
      }
      // 失败明细要逐条告诉用户（哪些删掉了、哪些因为有订单删不掉）
      if (data.failedCount > 0) {
        const lines = data.failed.slice(0, 10).map((f: any) => `• ${f.name || f.id}：${f.reason}`)
        const more = data.failed.length > 10 ? `\n… 还有 ${data.failed.length - 10} 个` : ''
        alert(`已删除 ${data.deleted} 个，${data.failedCount} 个失败：\n${lines.join('\n')}${more}`)
      } else {
        alert(`✅ 已删除 ${data.deleted} 个商品`)
      }
    } catch (e: any) {
      alert('批量删除失败: ' + (e?.message || e))
    }
    setIsBatchDeleting(false)
  }

  /** ★ 批量操作：加库存 / 改价 / 改名 */
  const runBatch = async () => {
    if (!batchOp || !selectedIds.length) return
    const f = batchForm
    let params: any = {}
    let title = ''
    if (batchOp === 'inventory') {
      title = f.invMode === 'add'
        ? `给 ${selectedIds.length} 个商品${f.invScope === 'product' ? '的商品' : '的每个变体'}加 ${f.invValue} 件库存`
        : `把 ${selectedIds.length} 个商品${f.invScope === 'product' ? '的商品' : '的每个变体'}库存设为 ${f.invValue}`
      params = { mode: f.invMode, value: f.invValue, scope: f.invScope }
    } else if (batchOp === 'price') {
      title = f.priceMode === 'percent'
        ? `把 ${selectedIds.length} 个商品${f.priceScope === 'product' ? '的主价' : '的主价和变体价'}调整 ${f.priceValue}%`
        : `把 ${selectedIds.length} 个商品${f.priceScope === 'product' ? '的主价' : '的主价和变体价'}设为 ${f.priceValue}`
      params = { mode: f.priceMode, value: f.priceValue, scope: f.priceScope, alsoCompare: f.alsoCompare }
    } else {
      title = `把 ${selectedIds.length} 个商品${f.renameScope === 'product' ? '的商品名' : '的变体名'}改成「颜色+随机数字」（${f.digits} 位）`
      params = { digits: f.digits, sep: f.sep, prefix: f.prefix, scope: f.renameScope }
    }
    if (!confirm(`确定？\n\n${title}`)) return
    setBatchRunning(true)
    try {
      const res = await adminFetch('/api/admin/products/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, op: batchOp, params }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('批量操作失败: ' + (data?.error || res.status))
      } else {
        const extra = data.failedCount > 0 ? `\n${data.failedCount} 个失败：${data.failed.slice(0, 3).map((x: any) => x.name).join('，')}` : ''
        alert(`✅ 已处理 ${data.updated} / ${data.total} 个商品${extra}`)
        setBatchOp(null)
        setSelectedIds([])
        fetchProducts()
      }
    } catch (e: any) {
      alert('批量操作失败: ' + (e?.message || e))
    }
    setBatchRunning(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return
    try {
      const res = await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSelectedIds(prev => prev.filter(x => x !== id))
        fetchProducts()
      }
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
        // Save warehouse inventory
        const savedProductId = editingProduct ? editingProduct.id : data.data?.id
        if (savedProductId) {
          for (const [warehouseId, quantity] of Object.entries(warehouseInventory)) {
            if (quantity && parseInt(quantity as string) > 0) {
              await adminFetch('/api/admin/product-inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: savedProductId, warehouseId, quantity: parseInt(quantity as string) }),
              })
            }
          }
        }
        // 新建产品时变体是先在本地攒着的 → 保存后补一次落库
        if (!editingProduct && productVariants.length && savedProductId) {
          try { await persistVariants(savedProductId, productVariants) } catch (e) { console.error(e) }
        }
        setShowProductModal(false)
        fetchProducts()
      } else {
        alert(data.error || 'Failed to save product')
      }
    } catch { alert('Failed to save product') }
    setIsSaving(false)
  }

  /** 手动加变体：新建时先存本地，编辑时直接落库 */
  const handleAddVariant = async () => {
    if (!variantForm.name || !variantForm.value) return
    const specs = [{ name: variantForm.name, value: variantForm.value }]
    const item: Variant = {
      id: `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: variantForm.name,
      value: variantForm.value,
      sku: variantForm.sku || null,
      price: variantForm.price ? Number(variantForm.price) : null,
      inventory: variantForm.inventory === '' ? null : Number(variantForm.inventory),
      image: variantForm.image || null,
      specs,
    }
    setVariantForm({ name: '', value: '', sku: '', price: '', inventory: '', image: '' })

    if (editingProduct) {
      setIsSaving(true)
      try {
        await persistVariants(editingProduct.id, [...productVariants, item])
      } catch { alert('Failed to add variant') }
      setIsSaving(false)
    } else {
      setProductVariants([...productVariants, item])
    }
  }

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm('Delete this variant?')) return
    if (!editingProduct) {
      setProductVariants(productVariants.filter(v => v.id !== variantId))
      return
    }
    try {
      await adminFetch(`/api/admin/products/${editingProduct.id}/variants/${variantId}`, { method: 'DELETE' })
      fetchVariants(editingProduct.id)
    } catch { alert('Failed to delete variant') }
  }

  /** 内联编辑变体（展示值 / 价格 / 库存 / SKU） */
  const startEditVariant = (v: Variant) => {
    setEditingVariantId(v.id)
    setVariantEdit({
      value: v.value || '',
      price: v.price != null ? String(v.price) : '',
      inventory: v.inventory != null ? String(v.inventory) : '',
      sku: v.sku || '',
    })
  }

  const handleSaveVariantEdit = async () => {
    if (!editingVariantId) return
    const target = productVariants.find(v => v.id === editingVariantId)
    if (!target) return
    const next = productVariants.map(v => v.id === editingVariantId ? {
      ...v,
      value: variantEdit.value,
      price: variantEdit.price === '' ? null : Number(variantEdit.price),
      inventory: variantEdit.inventory === '' ? null : Number(variantEdit.inventory),
      sku: variantEdit.sku || null,
    } : v)
    setEditingVariantId(null)
    if (editingProduct) {
      setIsSaving(true)
      try { await persistVariants(editingProduct.id, next) } catch { alert('Failed to save variant') }
      setIsSaving(false)
    } else {
      setProductVariants(next)
    }
  }

  /** 从采集品一键复制变体（颜色/尺码） */
  const handleCopyFromSupplier = async (supplierProductId: string) => {
    if (!editingProduct) {
      alert('请先保存产品，再复制变体')
      return
    }
    setCopying(true)
    try {
      const res = await adminFetch(`/api/admin/products/${editingProduct.id}/variants/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierProductId, append: false }),
      })
      const data = await res.json()
      if (data.success) {
        setProductVariants(data.data || [])
        setVariantDims(Array.isArray(data.dims) ? data.dims : [])
        setShowCopyPanel(false)
        alert(`✅ 已复制 ${data.copied} 个变体`)
      } else {
        alert(data.error || '复制失败')
      }
    } catch (e: any) {
      alert('复制失败: ' + (e?.message || e))
    }
    setCopying(false)
  }

  /** 一键把变体规格中→英 */
  const handleTranslateVariants = async () => {
    if (!editingProduct) {
      alert('请先保存产品，再翻译变体')
      return
    }
    if (!confirm('把变体的颜色/尺码等规格翻译成英文？（会覆盖当前变体文字）')) return
    setTranslating(true)
    try {
      const res = await adminFetch(`/api/admin/products/${editingProduct.id}/variants/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        setProductVariants(data.data || [])
        setVariantDims(Array.isArray(data.dims) ? data.dims : [])
        alert('✅ 已翻译成英文')
      } else {
        alert(data.error || '翻译失败')
      }
    } catch (e: any) {
      alert('翻译失败: ' + (e?.message || e))
    }
    setTranslating(false)
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

  const COMMON_ATTRIBUTES = ['Color', 'Size', 'Material', 'Style', 'Weight', 'Dimensions',
    '颜色', '尺码', '尺寸', '规格', '款式', '材质', '型号']

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
              <Button onClick={openAdd}><Icons.Plus size={18} className="mr-2" />Add Product</Button>
            </div>
          </div>
          <div className="mb-4">
            <div className="relative max-w-md">
              <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-joy-gray-400" />
              <input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none" />
            </div>
          </div>

          {/* 批量操作栏 */}
          {selectedIds.length > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-joy-orange/40 bg-joy-orange/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-joy-gray-800">已选 {selectedIds.length} 个商品</span>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-joy-gray-500 hover:text-joy-gray-800 underline"
                >
                  取消选择
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setBatchOp('inventory')} className="!bg-joy-orange hover:!bg-joy-orange/90">
                  <Icons.Package size={16} className="mr-2" />批量加库存
                </Button>
                <Button onClick={() => setBatchOp('price')} className="!bg-joy-orange hover:!bg-joy-orange/90">
                  <Icons.DollarSign size={16} className="mr-2" />批量改价
                </Button>
                <Button onClick={() => setBatchOp('rename')} className="!bg-joy-orange hover:!bg-joy-orange/90">
                  <Icons.Edit3 size={16} className="mr-2" />批量改名
                </Button>
                <Button
                  onClick={handleBatchDelete}
                  isLoading={isBatchDeleting}
                  className="!bg-red-500 hover:!bg-red-600"
                >
                  <Icons.Trash2 size={16} className="mr-2" />批量删除
                </Button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-joy-gray-50">
                  <tr>
                    <th className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.includes(p.id))}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-joy-gray-300 cursor-pointer"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Product</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">SKU</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Price</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Stock</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-joy-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-joy-gray-500">No products found</td></tr>
                  ) : filteredProducts.map((product) => (
                    <tr key={product.id} className={`hover:bg-joy-gray-50 transition-colors ${selectedIds.includes(product.id) ? 'bg-joy-orange/5' : ''}`}>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${product.name}`}
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="w-4 h-4 rounded border-joy-gray-300 cursor-pointer"
                        />
                      </td>
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
                            <p className="text-xs text-joy-gray-500">{product.categories?.map((c: any) => c.name).join(', ') || 'Uncategorized'}</p>
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
                <Button variant="secondary" size="sm" onClick={() => setShowVariantPanel(!showVariantPanel)}>
                  {showVariantPanel ? 'Hide Variants' : `Variants (${productVariants.length})`}
                </Button>
                <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
              </div>
            </div>

            <div className="flex">
              {/* Main Form */}
              <div className="flex-1 p-6 space-y-4">
                <Input label="Product Name *" placeholder="Enter product name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="SKU *" placeholder="e.g., AC-001" value={form.sku} onChange={(e) => setForm({...form, sku: e.target.value})} />
                  <div><label className="block text-sm font-medium text-joy-gray-700 mb-2">Categories</label><div className="space-y-1 max-h-48 overflow-y-auto border-2 border-joy-gray-200 rounded-xl p-3">{buildCategoryTree(categories).map(cat => renderCategoryCheckbox(cat, form.categoryIds, (ids) => setForm({...form, categoryIds: ids})))}</div></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Price (USD) *" type="number" placeholder="0.00" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} />
                  <Input label="Compare At Price" type="number" placeholder="0.00" value={form.comparePrice} onChange={(e) => setForm({...form, comparePrice: e.target.value})} />
                  <Input label="Cost Price" type="number" placeholder="0.00" value={form.costPrice} onChange={(e) => setForm({...form, costPrice: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Min Order Qty" type="number" placeholder="1" value={form.minOrderQty} onChange={(e) => setForm({...form, minOrderQty: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Inventory *" type="number" placeholder="0" value={form.inventory} readOnly className="bg-joy-gray-50" />
                  <Input label="Low Stock Alert" type="number" placeholder="10" value={form.lowStockAlert} onChange={(e) => setForm({...form, lowStockAlert: e.target.value})} />
                  <Input label="Weight (kg)" type="number" step="0.01" placeholder="0.5" value={form.weight || ''} onChange={(e) => setForm({...form, weight: e.target.value})} />
                </div>
                {/* Tiered Pricing —— 默认只 1 段（采集价），第 2/3 段自己加 */}
                <div className="bg-joy-gray-50 rounded-xl p-4">
                  <h4 className="font-medium text-joy-gray-900 mb-3">Tiered Pricing</h4>
                  <p className="text-xs text-joy-gray-500 mb-3">
                    默认只有第一段（= 基础价）。需要的话点「+ 添加一段」自己加第 2、3 段；不加就一直是一段。
                  </p>
                  {(() => {
                    const basePrice = parseFloat(form.price) || 0
                    // 读已保存的段；没有就默认只给 1 段
                    let tiers: Array<{ minQty: number; maxQty: number | null; price: number | string }> = []
                    try {
                      if (form.tieredPricing) {
                        const parsed = JSON.parse(form.tieredPricing)
                        if (parsed && Array.isArray(parsed.tiers) && parsed.tiers.length > 0) {
                          tiers = parsed.tiers.map((t: any) => ({
                            minQty: Number(t.minQty) || 1,
                            maxQty: t.maxQty === null || t.maxQty === undefined ? null : Number(t.maxQty),
                            price: t.price !== undefined && t.price !== null && t.price !== '' ? Number(t.price) : basePrice,
                          }))
                        }
                      }
                    } catch {}
                    if (!tiers.length) {
                      // ★ 默认只有第一段
                      tiers = [{ minQty: 1, maxQty: null, price: basePrice }]
                    }
                    const writeTiers = (next: typeof tiers) =>
                      setForm({ ...form, tieredPricing: JSON.stringify({ tiers: next }) })
                    return (
                      <div>
                        <div className="grid grid-cols-3 gap-3">
                          {tiers.map((tier, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-3 border border-joy-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-joy-gray-900">
                                  {tier.maxQty ? `${tier.minQty}-${tier.maxQty} pcs` : `${tier.minQty}+ pcs`}
                                </span>
                                {tiers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => writeTiers(tiers.filter((_, i) => i !== idx))}
                                    className="text-xs text-red-500 hover:text-red-700"
                                    title="删除这一段"
                                  >
                                    删除
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min="1"
                                placeholder="起始数量"
                                value={tier.minQty}
                                onChange={e => {
                                  const v = parseInt(e.target.value) || 1
                                  writeTiers(tiers.map((t, i) => (i === idx ? { ...t, minQty: v } : t)))
                                }}
                                className="w-full px-3 py-1.5 mb-1 border border-joy-gray-200 rounded-lg text-sm focus:border-joy-orange focus:outline-none"
                              />
                              <input
                                type="number"
                                min="1"
                                placeholder="结束数量（留空=不限）"
                                value={tier.maxQty ?? ''}
                                onChange={e => {
                                  const v = e.target.value.trim()
                                  writeTiers(
                                    tiers.map((t, i) => (i === idx ? { ...t, maxQty: v ? parseInt(v) : null } : t))
                                  )
                                }}
                                className="w-full px-3 py-1.5 mb-1 border border-joy-gray-200 rounded-lg text-sm focus:border-joy-orange focus:outline-none"
                              />
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Price"
                                value={tier.price ?? ''}
                                onChange={e => {
                                  const newTiers = tiers.map((t, i) => (i === idx ? { ...t, price: e.target.value } : t))
                                  writeTiers(newTiers)
                                }}
                                className="w-full px-3 py-2 border border-joy-gray-200 rounded-lg text-sm focus:border-joy-orange focus:outline-none mb-1"
                              />
                              <p className="text-xs text-joy-gray-400">第 {idx + 1} 段单价</p>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const last = tiers[tiers.length - 1]
                            const nextMin = (last?.maxQty ? last.maxQty : last?.minQty || 1) + 1
                            writeTiers([
                              ...tiers,
                              { minQty: nextMin, maxQty: null, price: basePrice },
                            ])
                          }}
                          className="mt-3 px-3 py-1.5 bg-white border border-joy-gray-300 rounded-lg text-sm text-joy-gray-700 hover:bg-joy-gray-50"
                        >
                          + 添加一段
                        </button>
                      </div>
                    )
                  })()}
                </div>
                {/* Warehouse Inventory */}
                {warehouses.length > 0 && (
                  <div className="bg-joy-gray-50 rounded-xl p-4">
                    <h4 className="font-medium text-joy-gray-900 mb-3">Warehouse Inventory</h4>
                    <p className="text-xs text-joy-gray-500 mb-3">Set inventory for each warehouse. Leave empty or 0 if not available.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {warehouses.map(w => (
                        <div key={w.id} className="bg-white rounded-lg p-3 border border-joy-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-joy-gray-900">{w.name}</span>
                            {w.isDefault && <span className="text-xs text-joy-orange">Default</span>}
                          </div>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={warehouseInventory[w.id] || ''}
                            onChange={e => {
                              const newInv = { ...warehouseInventory, [w.id]: e.target.value }
                              setWarehouseInventory(newInv)
                              const total = Object.values(newInv).reduce((sum: number, qty) => sum + (parseInt(qty as string) || 0), 0)
                              setForm({...form, inventory: String(total)})
                            }}
                            className="w-full px-3 py-2 border border-joy-gray-200 rounded-lg text-sm focus:border-joy-orange focus:outline-none"
                          />
                          <p className="text-xs text-joy-gray-400 mt-1">{w.country}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  <RichTextEditor content={form.description} onChange={(v) => setForm({...form, description: v})} placeholder="Full description..." />
                </div>
                <Input label="Short Description" placeholder="Brief description" value={form.shortDesc} onChange={(e) => setForm({...form, shortDesc: e.target.value})} />
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({...form, isActive: e.target.checked})} className="rounded border-joy-gray-300" /><span className="text-sm text-joy-gray-700">Active</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({...form, isFeatured: e.target.checked})} className="rounded border-joy-gray-300" /><span className="text-sm text-joy-gray-700">Featured</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isTrending} onChange={(e) => setForm({...form, isTrending: e.target.checked})} className="rounded border-joy-gray-300" /><span className="text-sm text-joy-gray-700">Trending</span></label>
                </div>
              </div>

              {/* Variants Panel */}
              {showVariantPanel && (
                <div className="w-96 border-l border-joy-gray-100 p-4 bg-joy-gray-50 overflow-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-joy-gray-900">Product Variants</h3>
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => {
                        setShowCopyPanel(!showCopyPanel)
                        if (!showCopyPanel && !supplierList.length) fetchSupplierList()
                      }} title="从采集品复制颜色/尺码">
                        📋 复制
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleTranslateVariants} isLoading={translating} title="颜色/尺码转英文">
                        🌐 EN
                      </Button>
                    </div>
                  </div>

                  {!editingProduct && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                      新建产品：变体先存在本地，点「Save Product」后自动落库
                    </p>
                  )}

                  {/* 从采集品复制 */}
                  {showCopyPanel && (
                    <div className="bg-white rounded-xl p-3 mb-3 border border-joy-orange/30">
                      <p className="text-sm font-medium text-joy-gray-700 mb-2">从采集品复制颜色/尺码</p>
                      {supplierLoading ? (
                        <p className="text-xs text-joy-gray-400 py-2">加载中…</p>
                      ) : supplierList.length === 0 ? (
                        <p className="text-xs text-joy-gray-400 py-2">没有采集品，先去「1688 采集」页采集</p>
                      ) : (
                        <div className="max-h-52 overflow-auto space-y-1">
                          {supplierList.map((s: any) => (
                            <button
                              key={s.id}
                              onClick={() => handleCopyFromSupplier(s.id)}
                              disabled={copying || !s.variantCount}
                              className="w-full text-left px-2 py-1.5 rounded hover:bg-joy-orange/10 disabled:opacity-50"
                            >
                              <div className="text-xs font-medium text-joy-gray-800 truncate">{s.title}</div>
                              <div className="text-[10px] text-joy-gray-400 truncate">
                                {s.sourceId} · {s.variantCount ? `${s.variantCount} 变体` : '无变体'}
                                {s.dimNames && s.dimNames.length ? ` · ${s.dimNames.join('/')}` : ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 维度汇总 */}
                  {variantDims.length > 0 && (
                    <div className="bg-joy-orange/10 rounded-lg px-3 py-2 mb-3">
                      <p className="text-xs text-joy-gray-600">
                        规格维度：{variantDims.map(d => `${d.name}（${(d.values || []).length}）`).join(' / ')}
                      </p>
                    </div>
                  )}

                  {/* Add Variant Form */}
                  <div className="bg-white rounded-xl p-4 mb-4 space-y-3">
                    <p className="text-sm font-medium text-joy-gray-700">Add Variant</p>
                    <select className="w-full px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={variantForm.name} onChange={(e) => setVariantForm({...variantForm, name: e.target.value})}>
                      <option value="">Select attribute</option>
                      {COMMON_ATTRIBUTES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <Input placeholder="Value (e.g., 红色 / Red, XL)" value={variantForm.value} onChange={(e) => setVariantForm({...variantForm, value: e.target.value})} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Variant SKU" value={variantForm.sku} onChange={(e) => setVariantForm({...variantForm, sku: e.target.value})} />
                      <Input placeholder="Variant Price" type="number" value={variantForm.price} onChange={(e) => setVariantForm({...variantForm, price: e.target.value})} />
                    </div>
                    <Input placeholder="Inventory" type="number" value={variantForm.inventory} onChange={(e) => setVariantForm({...variantForm, inventory: e.target.value})} />
                    <Input placeholder="Image URL (optional)" value={variantForm.image} onChange={(e) => setVariantForm({...variantForm, image: e.target.value})} />
                    <Button size="sm" className="w-full" onClick={handleAddVariant} isLoading={isSaving} disabled={!variantForm.name || !variantForm.value}>Add Variant</Button>
                  </div>

                  {/* Variant List */}
                  <div className="space-y-2">
                    {productVariants.length === 0 ? (
                      <p className="text-sm text-joy-gray-400 text-center py-4">No variants yet</p>
                    ) : productVariants.map(v => (
                      <div key={v.id} className="bg-white rounded-lg p-3">
                        {editingVariantId === v.id ? (
                          /* 内联编辑 */
                          <div className="space-y-2">
                            <Input placeholder="展示值" value={variantEdit.value} onChange={(e) => setVariantEdit({...variantEdit, value: e.target.value})} />
                            <div className="grid grid-cols-2 gap-2">
                              <Input placeholder="价格" type="number" value={variantEdit.price} onChange={(e) => setVariantEdit({...variantEdit, price: e.target.value})} />
                              <Input placeholder="库存" type="number" value={variantEdit.inventory} onChange={(e) => setVariantEdit({...variantEdit, inventory: e.target.value})} />
                            </div>
                            <Input placeholder="SKU" value={variantEdit.sku} onChange={(e) => setVariantEdit({...variantEdit, sku: e.target.value})} />
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1" onClick={handleSaveVariantEdit} isLoading={isSaving}>保存</Button>
                              <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditingVariantId(null)}>取消</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            {v.image && (
                              <img src={v.image} alt="" className="w-9 h-9 rounded object-cover border border-joy-gray-200 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              {/* 规格明细 —— 之前后台看不到的就是这个 */}
                              {v.specs && v.specs.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {v.specs.map((sp, i) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-joy-gray-100 text-joy-gray-700">
                                      {sp.name}: <span className="font-medium">{sp.value}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-joy-gray-400 mb-1">规格：{v.name}</p>
                              )}
                              <p className="text-sm font-medium text-joy-gray-900 truncate">{v.value}</p>
                              <p className="text-xs text-joy-gray-500">
                                {v.price ? `$${v.price}` : '—'} · Stock: {v.inventory ?? '—'}
                                {v.sku ? ` · ${v.sku}` : ''}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <button onClick={() => startEditVariant(v)} className="p-1 hover:bg-joy-gray-100 rounded" title="编辑">
                                <Icons.Edit3 size={14} className="text-joy-gray-500" />
                              </button>
                              <button onClick={() => handleDeleteVariant(v.id)} className="p-1 hover:bg-red-50 rounded" title="删除">
                                <Icons.Trash2 size={14} className="text-red-500" />
                              </button>
                            </div>
                          </div>
                        )}
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

      {/* ★ 批量操作弹窗（2026-10-28） */}
      {batchOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !batchRunning && setBatchOp(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-joy-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-joy-gray-900">
                {batchOp === 'inventory' ? '批量加库存' : batchOp === 'price' ? '批量改价' : '批量改名'}
                <span className="ml-2 text-sm font-normal text-joy-gray-500">已选 {selectedIds.length} 个商品</span>
              </h2>
              <button onClick={() => setBatchOp(null)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              {batchOp === 'inventory' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">方式</label>
                    <div className="flex gap-2">
                      <button onClick={() => setBatchForm({ ...batchForm, invMode: 'add' })} className={`px-4 py-2 rounded-xl text-sm border-2 ${batchForm.invMode === 'add' ? 'border-joy-orange bg-joy-orange/10 text-joy-orange font-medium' : 'border-joy-gray-200'}`}>在现有基础上加</button>
                      <button onClick={() => setBatchForm({ ...batchForm, invMode: 'set' })} className={`px-4 py-2 rounded-xl text-sm border-2 ${batchForm.invMode === 'set' ? 'border-joy-orange bg-joy-orange/10 text-joy-orange font-medium' : 'border-joy-gray-200'}`}>直接设为</button>
                    </div>
                  </div>
                  <Input label="数量" type="number" value={String(batchForm.invValue)} onChange={(e) => setBatchForm({ ...batchForm, invValue: Number(e.target.value) || 0 })} />
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">作用范围</label>
                    <select value={batchForm.invScope} onChange={(e) => setBatchForm({ ...batchForm, invScope: e.target.value as any })} className="w-full px-3 py-2.5 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none">
                      <option value="both">商品总量 + 每个变体</option>
                      <option value="variant">只改变体库存（前台按变体显示）</option>
                      <option value="product">只改商品总库存</option>
                    </select>
                    <p className="mt-1 text-xs text-joy-gray-500">变体库存原本是「未知（null）」的，按 0 起算。</p>
                  </div>
                </>
              )}

              {batchOp === 'price' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">方式</label>
                    <div className="flex gap-2">
                      <button onClick={() => setBatchForm({ ...batchForm, priceMode: 'percent' })} className={`px-4 py-2 rounded-xl text-sm border-2 ${batchForm.priceMode === 'percent' ? 'border-joy-orange bg-joy-orange/10 text-joy-orange font-medium' : 'border-joy-gray-200'}`}>按百分比</button>
                      <button onClick={() => setBatchForm({ ...batchForm, priceMode: 'set' })} className={`px-4 py-2 rounded-xl text-sm border-2 ${batchForm.priceMode === 'set' ? 'border-joy-orange bg-joy-orange/10 text-joy-orange font-medium' : 'border-joy-gray-200'}`}>设为固定值</button>
                    </div>
                  </div>
                  <Input label={batchForm.priceMode === 'percent' ? '百分比（负数=降价，如 -20）' : '新价格（USD）'} type="number" value={String(batchForm.priceValue)} onChange={(e) => setBatchForm({ ...batchForm, priceValue: Number(e.target.value) || 0 })} />
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">作用范围</label>
                    <select value={batchForm.priceScope} onChange={(e) => setBatchForm({ ...batchForm, priceScope: e.target.value as any })} className="w-full px-3 py-2.5 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none">
                      <option value="both">主价 + 变体价</option>
                      <option value="variant">只改变体价</option>
                      <option value="product">只改主价</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-joy-gray-700">
                    <input type="checkbox" checked={batchForm.alsoCompare} onChange={(e) => setBatchForm({ ...batchForm, alsoCompare: e.target.checked })} />
                    同时调整划线价（comparePrice）
                  </label>
                </>
              )}

              {batchOp === 'rename' && (
                <>
                  <div className="rounded-xl bg-joy-gray-50 p-3 text-sm text-joy-gray-700">
                    规则：<b>颜色 + 空格 + 随机数字</b>，例如「粉色 4827」。
                    同一商品内随机数字不重复；颜色维度之外的规格（尺码等）保持不变。
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="随机数字位数" type="number" value={String(batchForm.digits)} onChange={(e) => setBatchForm({ ...batchForm, digits: Number(e.target.value) || 4 })} />
                    <Input label="前缀（可选）" value={batchForm.prefix} onChange={(e) => setBatchForm({ ...batchForm, prefix: e.target.value })} placeholder="例：F" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">作用范围</label>
                    <select value={batchForm.renameScope} onChange={(e) => setBatchForm({ ...batchForm, renameScope: e.target.value as any })} className="w-full px-3 py-2.5 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none">
                      <option value="variant">只改变体名（前台选择器显示）</option>
                      <option value="product">只改商品名</option>
                      <option value="both">变体名 + 商品名</option>
                    </select>
                    <p className="mt-1 text-xs text-joy-gray-500">变体名会同步更新选择器（specs）和维度列表，前台三处显示一致。</p>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-joy-gray-100 px-6 py-4 flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setBatchOp(null)} disabled={batchRunning}>取消</Button>
              <Button onClick={runBatch} isLoading={batchRunning}>确认执行</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

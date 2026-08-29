'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Category {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  bannerImage?: string | null
  parentId?: string | null
  _count?: { products: number }
  children?: Category[]
}

export default function AdminCategoriesPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    image: '',
    bannerImage: '',
    parentId: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) { router.push('/login'); return }
    try {
      const user = JSON.parse(userStr)
      if (user.role !== 'admin') { router.push('/'); return }
      setIsAdmin(true)
      fetchCategories()
    } catch { router.push('/login') }
    setIsLoading(false)
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories/crud', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const data = await res.json()
      if (data.success) setCategories(data.data)
    } catch (err) { console.error(err) }
  }

  const openAdd = () => {
    setEditingCategory(null)
    setForm({ name: '', slug: '', description: '', image: '', bannerImage: '', parentId: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (cat: Category) => {
    setEditingCategory(cat)
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      image: cat.image || '',
      bannerImage: cat.bannerImage || '',
      parentId: cat.parentId || '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      setError('Name and slug are required')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const url = editingCategory ? '/api/admin/categories/crud' : '/api/admin/categories/crud'
      const method = editingCategory ? 'PUT' : 'POST'
      const bodyData = editingCategory ? { id: editingCategory.id, ...form } : form
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(bodyData),
      })
      const data = await res.json()
      if (data.success) {
        setShowModal(false)
        fetchCategories()
      } else {
        setError(data.error || 'Failed to save category')
      }
    } catch (err: any) {
      setError(err.message)
    }
    setIsSaving(false)
  }

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/categories/crud?id=${cat.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      const data = await res.json()
      if (data.success) {
        fetchCategories()
      } else {
        alert(data.error || 'Failed to delete')
      }
    } catch (err) { alert('Failed to delete') }
  }

  const generateSlug = () => {
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    setForm({ ...form, slug })
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-joy-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin')} className="p-2 hover:bg-joy-gray-100 rounded-lg">
              <Icons.ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-joy-gray-900">Categories</h1>
          </div>
          <Button onClick={openAdd}>
            <Icons.Plus size={16} className="mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-joy-gray-50 border-b border-joy-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-joy-gray-600">Category</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-joy-gray-600">Slug</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-joy-gray-600">Products</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-joy-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-joy-gray-100">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-joy-gray-500">
                    No categories yet. Click "Add Category" to create one.
                  </td>
                </tr>
              ) : categories.map(cat => (
                <tr key={cat.id} className="hover:bg-joy-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {cat.image && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-joy-gray-100 flex-shrink-0">
                          <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-joy-gray-800">{cat.name}</p>
                        {cat.description && (
                          <p className="text-sm text-joy-gray-500 truncate max-w-xs">{cat.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm text-joy-gray-600 bg-joy-gray-100 px-2 py-1 rounded">
                      {cat.slug}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-joy-gray-500">
                      {cat._count?.products || 0} products
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-2 hover:bg-joy-gray-100 rounded-lg text-joy-gray-600 hover:text-joy-orange transition-colors"
                      >
                        <Icons.Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className="p-2 hover:bg-joy-gray-100 rounded-lg text-joy-gray-600 hover:text-red-500 transition-colors"
                      >
                        <Icons.Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-joy-gray-100">
              <h2 className="text-lg font-bold text-joy-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-full">
                <Icons.X size={20} className="text-joy-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Name *"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    onBlur={generateSlug}
                    placeholder="e.g., Home Decor"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label="Slug *"
                    value={form.slug}
                    onChange={e => setForm({ ...form, slug: e.target.value })}
                    placeholder="e.g., home-decor"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none resize-none"
                    placeholder="Optional description..."
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label="Image URL"
                    value={form.image}
                    onChange={e => setForm({ ...form, image: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label="Banner Image URL"
                    value={form.bannerImage}
                    onChange={e => setForm({ ...form, bannerImage: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">Parent Category</label>
                  <select
                    value={form.parentId}
                    onChange={e => setForm({ ...form, parentId: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
                  >
                    <option value="">None (Top Level)</option>
                    {categories.filter(c => c.id !== editingCategory?.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-joy-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '', parentId: '' })
  const [activeTab, setActiveTab] = useState<'general' | 'categories'>('general')

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
    fetchCategories()
  }, [isAdmin])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      if (data.success) setCategories(data.data)
    } catch (err) { console.error(err) }
  }

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => setIsSaving(false), 1000)
  }

  const openAddCategory = () => {
    setEditingCategory(null)
    setCategoryForm({ name: '', slug: '', description: '', parentId: '' })
    setShowCategoryModal(true)
  }

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat)
    setCategoryForm({ name: cat.name, slug: cat.slug, description: cat.description || '', parentId: cat.parentId || '' })
    setShowCategoryModal(true)
  }

  const handleCategorySubmit = async () => {
    if (!categoryForm.name) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm),
      })
      const data = await res.json()
      if (data.success) {
        setShowCategoryModal(false)
        fetchCategories()
      } else {
        alert(data.error)
      }
    } catch { alert('Failed to save category') }
    setIsSaving(false)
  }

  const parentCategories = categories.filter(c => !c.parentId)
  const childCategories = categories.filter(c => c.parentId)

  const getChildOf = (parentId: string) => childCategories.filter(c => c.parentId === parentId)

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">Settings</h1>
            <Link href="/admin/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-joy-gray-200 mb-6">
            <button onClick={() => setActiveTab('general')} className={`px-6 py-4 font-medium text-sm border-b-2 -mb-px transition-colors ${activeTab === 'general' ? 'text-joy-orange border-joy-orange' : 'text-joy-gray-500 border-transparent hover:text-joy-gray-700'}`}>
              General
            </button>
            <button onClick={() => setActiveTab('categories')} className={`px-6 py-4 font-medium text-sm border-b-2 -mb-px transition-colors ${activeTab === 'categories' ? 'text-joy-orange border-joy-orange' : 'text-joy-gray-500 border-transparent hover:text-joy-gray-700'}`}>
              Categories ({categories.length})
            </button>
          </div>

          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-6 flex items-center gap-2">
                  <Icons.Globe size={20} className="text-joy-orange" />
                  Store Information
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Store Name" defaultValue="Fiestaflare Wholesaler" />
                  <Input label="Store Email" defaultValue="admin@fiestaflare.com" type="email" />
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-6 flex items-center gap-2">
                  <Icons.Truck size={20} className="text-joy-orange" />
                  Shipping Settings
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Default Shipping (USD)" defaultValue="9.99" type="number" />
                  <Input label="Free Shipping Threshold (USD)" defaultValue="99" type="number" />
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-6 flex items-center gap-2">
                  <Icons.Percent size={20} className="text-joy-orange" />
                  Tax Settings
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Tax Rate (%)" defaultValue="8.5" type="number" />
                  <Input label="Tax ID" defaultValue="12-3456789" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} isLoading={isSaving}>Save All Settings</Button>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-semibold text-lg text-joy-gray-900">Categories</h2>
                  <Button onClick={openAddCategory}><Icons.Plus size={18} className="mr-2" />Add Category</Button>
                </div>
                {categories.length === 0 ? (
                  <p className="text-center text-joy-gray-500 py-8">No categories yet. Add your first category.</p>
                ) : (
                  <div className="space-y-4">
                    {parentCategories.map(cat => (
                      <div key={cat.id} className="border border-joy-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-joy-gray-900">{cat.name}</p>
                            <p className="text-sm text-joy-gray-500">/{cat.slug}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditCategory(cat)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.Copy size={16} className="text-joy-gray-500" /></button>
                          </div>
                        </div>
                        {getChildOf(cat.id).length > 0 && (
                          <div className="mt-3 ml-4 space-y-2 border-l-2 border-joy-gray-100 pl-4">
                            {getChildOf(cat.id).map(child => (
                              <div key={child.id} className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-joy-gray-700">{child.name}</p>
                                  <p className="text-xs text-joy-gray-500">/{child.slug}</p>
                                </div>
                                <button onClick={() => openEditCategory(child)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.Copy size={14} className="text-joy-gray-500" /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-joy-gray-100 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-joy-gray-900">{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="Category Name *" placeholder="e.g., Electronics" value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})} />
              <Input label="Slug" placeholder="auto-generated" value={categoryForm.slug} onChange={(e) => setCategoryForm({...categoryForm, slug: e.target.value})} />
              <Input label="Description" placeholder="Optional description" value={categoryForm.description} onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})} />
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">Parent Category (optional)</label>
                <select className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none" value={categoryForm.parentId} onChange={(e) => setCategoryForm({...categoryForm, parentId: e.target.value})}>
                  <option value="">None (Main Category)</option>
                  {parentCategories.filter(p => !editingCategory || p.id !== editingCategory.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-joy-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
              <Button onClick={handleCategorySubmit} isLoading={isSaving}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

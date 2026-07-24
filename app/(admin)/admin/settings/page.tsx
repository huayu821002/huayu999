'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'

interface SiteContent {
  id: string
  section: string
  title: string | null
  subtitle: string | null
  content: string | null
  isActive: boolean
  sortOrder: number
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
}

interface CategoryNode extends Category {
  children: CategoryNode[]
}

const HOMEPAGE_SECTIONS = [
  { key: 'hero_title', label: 'Hero Title', description: 'Main headline on homepage' },
  { key: 'hero_subtitle', label: 'Hero Subtitle', description: 'Sub-headline below the title' },
  { key: 'featured_title', label: 'Featured Section Title', description: 'Featured products section title' },
  { key: 'banners', label: 'Banners', description: 'Homepage banner images (JSON array of {image, link, alt})' },
  { key: 'trust_badges', label: 'Trust Badges', description: 'Trust badges shown below hero' },
  { key: 'category_title', label: 'Category Section Title', description: 'Shop by category title' },
]

export default function AdminSettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'homepage'>('general')

  // Categories state
  const [categories, setCategories] = useState<Category[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '', parentId: '' })

  // Homepage content state
  const [homepageContent, setHomepageContent] = useState<Record<string, SiteContent>>({})
  const [homepageForm, setHomepageForm] = useState<Record<string, { title: string; subtitle: string; content: string }>>({})

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
    if (activeTab === 'categories') fetchCategories()
    if (activeTab === 'homepage') fetchHomepageContent()
  }, [isAdmin, activeTab])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      if (data.success) setCategories(data.data)
    } catch (err) { console.error(err) }
  }

  const fetchHomepageContent = async () => {
    try {
      const res = await fetch('/api/admin/site-content')
      const data = await res.json()
      if (data.success) {
        const contentMap: Record<string, SiteContent> = {}
        const formMap: Record<string, { title: string; subtitle: string; content: string }> = {}
        data.data.forEach((item: SiteContent) => {
          contentMap[item.section] = item
          formMap[item.section] = {
            title: item.title || '',
            subtitle: item.subtitle || '',
            content: item.content || '',
          }
        })
        setHomepageContent(contentMap)
        setHomepageForm(formMap)
      }
    } catch (err) { console.error(err) }
  }

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  // Category helpers
  const buildTree = (cats: Category[], parentId: string | null = null): CategoryNode[] => {
    return cats.filter(c => c.parentId === parentId).map(c => ({ ...c, children: buildTree(cats, c.id) }))
  }
  const categoryTree = buildTree(categories)
  const flattenTree = (nodes: CategoryNode[], depth = 0): { cat: CategoryNode; depth: number }[] => {
    return nodes.flatMap(node => [{ cat: node, depth }, ...flattenTree(node.children, depth + 1)])
  }
  const flatCategories = flattenTree(categoryTree)

  const openAddCategory = (parentId?: string) => {
    setEditingCategory(null)
    setCategoryForm({ name: '', slug: '', description: '', parentId: parentId || '' })
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
      if (data.success) { setShowCategoryModal(false); fetchCategories() }
      else alert(data.error)
    } catch { alert('Failed to save category') }
    setIsSaving(false)
  }

  const getAllParentOptions = () => categories.filter(c => c.id !== editingCategory?.id)

  // Homepage helpers
  const handleHomepageSave = async (section: string) => {
    setIsSaving(true)
    try {
      const form = homepageForm[section]
      const res = await fetch('/api/admin/site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, ...form }),
      })
      const data = await res.json()
      if (data.success) { fetchHomepageContent(); alert('Saved!') }
      else alert(data.error)
    } catch { alert('Failed to save') }
    setIsSaving(false)
  }

  const handleSave = () => { setIsSaving(true); setTimeout(() => setIsSaving(false), 1000) }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">Settings</h1>
            <Link href="/admin/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
          </div>

          <div className="flex border-b border-joy-gray-200 mb-6">
            {[
              { key: 'general', label: 'General' },
              { key: 'categories', label: `Categories (${categories.length})` },
              { key: 'homepage', label: 'Homepage Content' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-6 py-4 font-medium text-sm border-b-2 -mb-px transition-colors ${activeTab === tab.key ? 'text-joy-orange border-joy-orange' : 'text-joy-gray-500 border-transparent hover:text-joy-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* General Tab */}
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
              <div className="flex justify-end">
                <Button onClick={handleSave} isLoading={isSaving}>Save Settings</Button>
              </div>
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-lg text-joy-gray-900">Category Hierarchy</h2>
                    <p className="text-sm text-joy-gray-500 mt-1">Manage your product categories and subcategories</p>
                  </div>
                  <Button onClick={() => openAddCategory()}><Icons.Plus size={18} className="mr-2" />Add Main Category</Button>
                </div>
                {categories.length === 0 ? (
                  <p className="text-center text-joy-gray-500 py-8">No categories yet. Add your first main category.</p>
                ) : (
                  <div className="space-y-2">
                    {flatCategories.map(({ cat, depth }) => (
                      <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-joy-gray-50 transition-colors" style={{ paddingLeft: `${depth * 24 + 12}px` }}>
                        <div className="flex items-center gap-2 flex-1">
                          {depth === 0 && <Icons.Package size={18} className="text-joy-gray-400" />}
                          {depth === 1 && <span className="text-joy-gray-300 ml-4"><Icons.ChevronRight size={14} /></span>}
                          {depth >= 2 && <span className="text-joy-gray-200 ml-8"><Icons.ChevronRight size={12} /></span>}
                          <div>
                            <p className="font-medium text-joy-gray-900">{cat.name}</p>
                            <p className="text-xs text-joy-gray-400">/{cat.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {depth < 3 && <button onClick={() => openAddCategory(cat.id)} className="p-2 hover:bg-joy-orange/10 rounded-lg text-joy-orange" title="Add subcategory"><Icons.Plus size={16} /></button>}
                          <button onClick={() => openEditCategory(cat)} className="p-2 hover:bg-joy-gray-100 rounded-lg" title="Edit"><Icons.Copy size={16} className="text-joy-gray-500" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Homepage Content Tab */}
          {activeTab === 'homepage' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-2">Homepage Editable Content</h2>
                <p className="text-sm text-joy-gray-500 mb-6">Edit the text and content displayed on your store homepage</p>
                <div className="space-y-6">
                  {HOMEPAGE_SECTIONS.map(section => (
                    <div key={section.key} className="border border-joy-gray-200 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-joy-gray-900">{section.label}</h3>
                          <p className="text-xs text-joy-gray-400 mt-1">{section.description}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Input
                          label="Title"
                          placeholder="Enter title text"
                          value={homepageForm[section.key]?.title || ''}
                          onChange={(e) => setHomepageForm({ ...homepageForm, [section.key]: { ...homepageForm[section.key], title: e.target.value } })}
                        />
                        {section.key !== 'banners' && section.key !== 'trust_badges' && (
                          <Input
                            label="Subtitle / Description"
                            placeholder="Enter subtitle or description"
                            value={homepageForm[section.key]?.subtitle || ''}
                            onChange={(e) => setHomepageForm({ ...homepageForm, [section.key]: { ...homepageForm[section.key], subtitle: e.target.value } })}
                          />
                        )}
                        {section.key === 'banners' && (
                          <div>
                            <label className="block text-sm font-medium text-joy-gray-700 mb-2">Banner Images (JSON array)</label>
                            <textarea
                              className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none text-sm font-mono"
                              rows={4}
                              placeholder={'[{"image":"https://...","link":"/products","alt":"Banner 1"}]'}
                              value={homepageForm[section.key]?.content || ''}
                              onChange={(e) => setHomepageForm({ ...homepageForm, [section.key]: { ...homepageForm[section.key], content: e.target.value } })}
                            />
                          </div>
                        )}
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => handleHomepageSave(section.key)} isLoading={isSaving}>Save</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-joy-gray-100 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-joy-gray-900">
                {editingCategory ? 'Edit Category' : (categoryForm.parentId ? 'Add Subcategory' : 'Add Main Category')}
              </h2>
              <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="Category Name *" placeholder="e.g., Electronics" value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})} />
              <Input label="Slug (auto-generated if empty)" placeholder="electronics" value={categoryForm.slug} onChange={(e) => setCategoryForm({...categoryForm, slug: e.target.value})} />
              <Input label="Description" placeholder="Optional description" value={categoryForm.description} onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})} />
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">
                  {editingCategory ? 'Move to Parent Category' : 'Parent Category (optional)'}
                </label>
                <select
                  className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
                  value={categoryForm.parentId}
                  onChange={(e) => setCategoryForm({...categoryForm, parentId: e.target.value})}
                >
                  <option value="">-- Main Category --</option>
                  {getAllParentOptions().map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-joy-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
              <Button onClick={handleCategorySubmit} isLoading={isSaving}>Save Category</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

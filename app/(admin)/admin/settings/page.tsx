'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'

interface SiteContent {
  id: string; section: string; title: string | null; subtitle: string | null; content: string | null; isActive: boolean; sortOrder: number
}
interface Category { id: string; name: string; slug: string; description: string | null; parentId: string | null }
interface CategoryNode extends Category { children: CategoryNode[] }
interface ShippingMethod {
  id: string; name: string; code: string; description: string | null
  baseCost: number; costPerKg: number; freeThreshold: number
  minWeight: number; maxWeight: number; estimatedDays: string | null
  isActive: boolean; sortOrder: number
}

const HOMEPAGE_SECTIONS = [
  { key: 'hero_title', label: 'Hero Title' },
  { key: 'hero_subtitle', label: 'Hero Subtitle' },
  { key: 'featured_title', label: 'Featured Section Title' },
  { key: 'banners', label: 'Banners (JSON)' },
  { key: 'trust_badges', label: 'Trust Badges' },
  { key: 'category_title', label: 'Category Section Title' },
  { key: 'new_arrivals', label: 'New Arrivals (title=false to disable)' },
]

const PAGE_SECTIONS = [
  { key: 'about_hero', label: 'About - Hero Title' },
  { key: 'about_content', label: 'About - Main Content (HTML)', multiline: true },
  { key: 'about_story', label: 'About - Company Story' },
  { key: 'about_values', label: 'About - Values (JSON array)' },
  { key: 'about_cta', label: 'About - CTA Section' },
  { key: 'contact_hero', label: 'Contact - Hero Title' },
  { key: 'contact_form', label: 'Contact - Form Title' },
  { key: 'contact_info', label: 'Contact - Info (JSON: email,whatsapp,phone,address,hours)' },
  { key: 'contact_extra', label: 'Contact - Extra Content (HTML)' },
]

export default function AdminSettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'homepage' | 'pages' | 'shipping' | 'custom_pages'>('general')

  // Categories
  const [categories, setCategories] = useState<Category[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '', parentId: '' })

  // Homepage
  const [homepageContent, setHomepageContent] = useState<Record<string, SiteContent>>({})
  const [homepageForm, setHomepageForm] = useState<Record<string, { title: string; subtitle: string; content: string }>>({})

  // Shipping
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [showShippingModal, setShowShippingModal] = useState(false)
  const [editingShipping, setEditingShipping] = useState<ShippingMethod | null>(null)
  const [shippingForm, setShippingForm] = useState({
    name: '', code: '', description: '', baseCost: '0', costPerKg: '0',
    freeThreshold: '0', minWeight: '0', maxWeight: '0', estimatedDays: '', isActive: true, sortOrder: '0'
  })

  // Custom Pages
  const [customPages, setCustomPages] = useState<any[]>([])
  const [showPageModal, setShowPageModal] = useState(false)
  const [editingPage, setEditingPage] = useState<any | null>(null)
  const [pageForm, setPageForm] = useState({
    title: '', slug: '', excerpt: '', content: '', featuredImage: '', template: 'default',
    metaTitle: '', metaDesc: '', status: 'draft', isActive: false, sortOrder: '0'
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
    if (activeTab === 'categories') fetchCategories()
    if (activeTab === 'homepage' || activeTab === 'pages') fetchHomepageContent()
    if (activeTab === 'shipping') fetchShippingMethods()
    if (activeTab === 'custom_pages') fetchCustomPages()
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
        const cm: Record<string, SiteContent> = {}
        const fm: Record<string, { title: string; subtitle: string; content: string }> = {}
        data.data.forEach((item: SiteContent) => {
          cm[item.section] = item
          fm[item.section] = { title: item.title || '', subtitle: item.subtitle || '', content: item.content || '' }
        })
        setHomepageContent(cm)
        setHomepageForm(fm)
      }
    } catch (err) { console.error(err) }
  }

  const fetchShippingMethods = async () => {
    try {
      const res = await fetch('/api/admin/shipping-methods')
      const data = await res.json()
      if (data.success) setShippingMethods(data.data)
    } catch (err) { console.error(err) }
  }

  const fetchCustomPages = async () => {
    try {
      const res = await fetch('/api/admin/pages')
      const data = await res.json()
      if (data.success) setCustomPages(data.data)
    } catch (err) { console.error(err) }
  }

  const openAddPage = () => {
    setEditingPage(null)
    setPageForm({
      title: '', slug: '', excerpt: '', content: '', featuredImage: '', template: 'default',
      metaTitle: '', metaDesc: '', status: 'draft', isActive: false, sortOrder: '0'
    })
    setShowPageModal(true)
  }

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  // Category helpers
  const buildTree = (cats: Category[], parentId: string | null = null): CategoryNode[] => cats.filter(c => c.parentId === parentId).map(c => ({ ...c, children: buildTree(cats, c.id) }))
  const flattenTree = (nodes: CategoryNode[], depth = 0): { cat: CategoryNode; depth: number }[] => nodes.flatMap(node => [{ cat: node, depth }, ...flattenTree(node.children, depth + 1)])

  const handleSave = () => { setIsSaving(true); setTimeout(() => setIsSaving(false), 1000) }

  // Category handlers
  const openAddCategory = (parentId?: string) => { setEditingCategory(null); setCategoryForm({ name: '', slug: '', description: '', parentId: parentId || '' }); setShowCategoryModal(true) }
  const openEditCategory = (cat: Category) => { setEditingCategory(cat); setCategoryForm({ name: cat.name, slug: cat.slug, description: cat.description || '', parentId: cat.parentId || '' }); setShowCategoryModal(true) }
  const handleCategorySubmit = async () => {
    if (!categoryForm.name) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(categoryForm) })
      const data = await res.json()
      if (data.success) { setShowCategoryModal(false); fetchCategories() } else alert(data.error)
    } catch { alert('Failed to save category') }
    setIsSaving(false)
  }

  // Shipping handlers
  const openAddShipping = () => { setEditingShipping(null); setShippingForm({ name: '', code: '', description: '', baseCost: '0', costPerKg: '0', freeThreshold: '0', minWeight: '0', maxWeight: '0', estimatedDays: '', isActive: true, sortOrder: String(shippingMethods.length) }); setShowShippingModal(true) }
  const openEditShipping = (m: ShippingMethod) => { setEditingShipping(m); setShippingForm({ name: m.name, code: m.code, description: m.description || '', baseCost: String(m.baseCost), costPerKg: String(m.costPerKg), freeThreshold: String(m.freeThreshold), minWeight: String(m.minWeight), maxWeight: String(m.maxWeight), estimatedDays: m.estimatedDays || '', isActive: m.isActive, sortOrder: String(m.sortOrder) }); setShowShippingModal(true) }
  const handleShippingSubmit = async () => {
    if (!shippingForm.name || !shippingForm.code) return
    setIsSaving(true)
    try {
      const url = editingShipping ? `/api/admin/shipping-methods/${editingShipping.id}` : '/api/admin/shipping-methods'
      const method = editingShipping ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shippingForm) })
      const data = await res.json()
      if (data.success) { setShowShippingModal(false); fetchShippingMethods() } else alert(data.error)
    } catch { alert('Failed to save shipping method') }
    setIsSaving(false)
  }
  const handleDeleteShipping = async (id: string) => {
    if (!confirm('Delete this shipping method?')) return
    try {
      await fetch(`/api/admin/shipping-methods/${id}`, { method: 'DELETE' })
      fetchShippingMethods()
    } catch { alert('Failed to delete') }
  }

  const openEditPage = (page: any) => {
    setEditingPage(page)
    setPageForm({
      title: page.title,
      slug: page.slug,
      excerpt: page.excerpt || '',
      content: page.content,
      featuredImage: page.featuredImage || '',
      template: page.template || 'default',
      metaTitle: page.metaTitle || '',
      metaDesc: page.metaDesc || '',
      status: page.status || 'draft',
      isActive: page.isActive,
      sortOrder: String(page.sortOrder || '0'),
    })
    setShowPageModal(true)
  }

  const handlePageSubmit = async () => {
    if (!pageForm.title || !pageForm.slug) {
      alert('Title and slug are required')
      return
    }
    setIsSaving(true)
    try {
      const url = editingPage ? `/api/admin/pages/${editingPage.id}` : '/api/admin/pages'
      const method = editingPage ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageForm),
      })
      const data = await res.json()
      console.log('Page save result:', data)
      if (data.success) {
        setShowPageModal(false)
        fetchCustomPages()
        alert(editingPage ? 'Page updated!' : 'Page created!')
      } else {
        alert('Error: ' + (data.error || 'Unknown error') + (data.code ? ` (${data.code})` : ''))
      }
    } catch (err) { 
      console.error('Submit error:', err)
      alert('Failed to save: ' + String(err))
    }
    setIsSaving(false)
  }

  const handleDeletePage = async (id: string) => {
    if (!confirm('Delete this page? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/admin/pages/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCustomPages()
        alert('Page deleted')
      } else {
        alert('Failed to delete')
      }
    } catch { alert('Failed to delete') }
  }

  // Homepage handlers
  const handleHomepageSave = async (section: string) => {
    setIsSaving(true)
    try {
      const form = homepageForm[section]
      const res = await fetch('/api/admin/site-content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section, ...form }) })
      const data = await res.json()
      if (data.success) { fetchHomepageContent(); alert('Saved!') } else alert(data.error)
    } catch { alert('Failed to save') }
    setIsSaving(false)
  }

  const handleSaveHomepage = async (sections: string[]) => {
    setIsSaving(true)
    try {
      for (const section of sections) {
        const form = homepageForm[section]
        if (form) {
          await fetch('/api/admin/site-content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section, ...form }) })
        }
      }
      fetchHomepageContent()
      alert('All page content saved!')
    } catch { alert('Failed to save') }
    setIsSaving(false)
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">Settings</h1>
            <Link href="/admin/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
          </div>

          <div className="flex border-b border-joy-gray-200 mb-6 overflow-x-auto">
            {[{ key: 'general', label: 'General' }, { key: 'categories', label: `Categories (${categories.length})` }, { key: 'homepage', label: 'Homepage' }, { key: 'pages', label: 'Pages' }, { key: 'shipping', label: `Shipping (${shippingMethods.length})` }, { key: 'custom_pages', label: 'Custom Pages' }].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-6 py-4 font-medium text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${activeTab === tab.key ? 'text-joy-orange border-joy-orange' : 'text-joy-gray-500 border-transparent hover:text-joy-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-6 flex items-center gap-2"><Icons.Globe size={20} className="text-joy-orange" />Store Information</h2>
                <div className="grid grid-cols-2 gap-4"><Input label="Store Name" defaultValue="Fiestaflare Wholesaler" /><Input label="Store Email" defaultValue="admin@fiestaflare.com" type="email" /></div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-6 flex items-center gap-2"><Icons.Truck size={20} className="text-joy-orange" />Shipping Settings</h2>
                <div className="grid grid-cols-2 gap-4"><Input label="Default Currency" defaultValue="USD" /><Input label="Default Country" defaultValue="United States" /></div>
              </div>
              <div className="flex justify-end"><Button onClick={handleSave} isLoading={isSaving}>Save Settings</Button></div>
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div><h2 className="font-semibold text-lg text-joy-gray-900">Category Hierarchy</h2><p className="text-sm text-joy-gray-500 mt-1">Manage product categories</p></div>
                  <Button onClick={() => openAddCategory()}><Icons.Plus size={18} className="mr-2" />Add Main Category</Button>
                </div>
                {categories.length === 0 ? <p className="text-center text-joy-gray-500 py-8">No categories yet.</p> : (
                  <div className="space-y-2">
                    {flattenTree(buildTree(categories)).map(({ cat, depth }) => (
                      <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-joy-gray-50" style={{ paddingLeft: `${depth * 24 + 12}px` }}>
                        <div className="flex items-center gap-2 flex-1">
                          {depth === 0 && <Icons.Package size={18} className="text-joy-gray-400" />}
                          {depth > 0 && <span className="text-joy-gray-300 ml-4"><Icons.ChevronRight size={14} /></span>}
                          <div><p className="font-medium text-joy-gray-900">{cat.name}</p><p className="text-xs text-joy-gray-400">/{cat.slug}</p></div>
                        </div>
                        <div className="flex items-center gap-1">
                          {depth < 3 && <button onClick={() => openAddCategory(cat.id)} className="p-2 hover:bg-joy-orange/10 rounded-lg text-joy-orange"><Icons.Plus size={16} /></button>}
                          <button onClick={() => openEditCategory(cat)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.Copy size={16} className="text-joy-gray-500" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Homepage Tab */}
          {activeTab === 'homepage' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-2">Homepage Content</h2><p className="text-sm text-joy-gray-500 mb-6">Edit text shown on store homepage</p>
                <div className="space-y-6">
                  {HOMEPAGE_SECTIONS.map(section => (
                    <div key={section.key} className="border border-joy-gray-200 rounded-xl p-5">
                      <h3 className="font-semibold text-joy-gray-900">{section.label}</h3>
                      <div className="space-y-3 mt-4">
                        <Input label="Title" placeholder="Title text" value={homepageForm[section.key]?.title || ''} onChange={e => setHomepageForm({ ...homepageForm, [section.key]: { ...homepageForm[section.key], title: e.target.value } })} />
                        {section.key !== 'banners' && <Input label="Subtitle" placeholder="Subtitle text" value={homepageForm[section.key]?.subtitle || ''} onChange={e => setHomepageForm({ ...homepageForm, [section.key]: { ...homepageForm[section.key], subtitle: e.target.value } })} />}
                        {section.key === 'banners' && (
                          <div><label className="block text-sm font-medium text-joy-gray-700 mb-2">Banner JSON</label><textarea className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 text-sm font-mono" rows={3} placeholder='[{"image":"url","link":"/","alt":"alt"}]' value={homepageForm[section.key]?.content || ''} onChange={e => setHomepageForm({ ...homepageForm, [section.key]: { ...homepageForm[section.key], content: e.target.value } })} /></div>
                        )}
                        <div className="flex justify-end"><Button size="sm" onClick={() => handleHomepageSave(section.key)} isLoading={isSaving}>Save</Button></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pages Tab - About & Contact */}
          {activeTab === 'pages' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-2">Page Content Editor</h2>
                <p className="text-sm text-joy-gray-500 mb-6">Edit About Us and Contact Us page content. Changes appear immediately on the storefront.</p>
                
                {PAGE_SECTIONS.map(section => (
                  <div key={section.key} className="mb-6 pb-6 border-b border-joy-gray-100 last:border-0">
                    <h3 className="font-medium text-joy-gray-900 mb-3">{section.label}</h3>
                    <div className="space-y-3">
                      <Input 
                        label="Title"
                        placeholder="Section title"
                        value={homepageForm[section.key]?.title || ''}
                        onChange={e => setHomepageForm({
                          ...homepageForm,
                          [section.key]: { ...homepageForm[section.key], title: e.target.value }
                        })}
                      />
                      <Input 
                        label="Subtitle"
                        placeholder="Section subtitle"
                        value={homepageForm[section.key]?.subtitle || ''}
                        onChange={e => setHomepageForm({
                          ...homepageForm,
                          [section.key]: { ...homepageForm[section.key], subtitle: e.target.value }
                        })}
                      />
                      {section.multiline ? (
                        <div>
                          <label className="block text-sm font-medium text-joy-gray-700 mb-2">Content (HTML supported)</label>
                          <textarea
                            className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange min-h-[120px] font-mono text-sm"
                            placeholder="<p>Your HTML content here...</p>"
                            value={homepageForm[section.key]?.content || ''}
                            onChange={e => setHomepageForm({
                              ...homepageForm,
                              [section.key]: { ...homepageForm[section.key], content: e.target.value }
                            })}
                          />
                        </div>
                      ) : (
                        <Input
                          label="Content"
                          placeholder="Content or JSON data"
                          value={homepageForm[section.key]?.content || ''}
                          onChange={e => setHomepageForm({
                            ...homepageForm,
                            [section.key]: { ...homepageForm[section.key], content: e.target.value }
                          })}
                        />
                      )}
                    </div>
                  </div>
                ))}
                
                <div className="flex justify-end">
                  <Button onClick={() => handleSaveHomepage(PAGE_SECTIONS.map(s => s.key))} isLoading={isSaving}>
                    Save Page Content
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Custom Pages Tab */}
          {activeTab === 'custom_pages' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-lg text-joy-gray-900">Custom Pages</h2>
                    <p className="text-sm text-joy-gray-500 mt-1">WordPress-style page management with templates and SEO</p>
                  </div>
                  <Button onClick={openAddPage}><Icons.Plus size={18} className="mr-2" />Add New Page</Button>
                </div>
                {customPages.length === 0 ? (
                  <p className="text-center text-joy-gray-500 py-8">No custom pages yet. Create one to get started.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-joy-gray-50">
                        <tr>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Title</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Slug</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Template</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Status</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-joy-gray-100">
                        {customPages.map(page => (
                          <tr key={page.id} className="hover:bg-joy-gray-50">
                            <td className="px-4 py-3 font-medium text-joy-gray-900">
                              <div>{page.title}</div>
                              {page.excerpt && <div className="text-xs text-joy-gray-500 mt-0.5 truncate max-w-[200px]">{page.excerpt}</div>}
                            </td>
                            <td className="px-4 py-3 font-mono text-sm text-joy-gray-600">/{page.slug}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-joy-gray-100 text-joy-gray-600 capitalize">
                                {page.template || 'default'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                                page.status === 'published' ? 'bg-joy-green/10 text-joy-green' : 
                                page.status === 'scheduled' ? 'bg-joy-orange/10 text-joy-orange' :
                                'bg-joy-gray-100 text-joy-gray-600'
                              }`}>
                                {page.status || 'draft'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <a href={`/${page.slug}`} target="_blank" className="p-2 hover:bg-joy-gray-100 rounded-lg" title="View Page">
                                  <Icons.ExternalLink size={16} className="text-joy-gray-500" />
                                </a>
                                <button onClick={() => openEditPage(page)} className="p-2 hover:bg-joy-gray-100 rounded-lg" title="Edit">
                                  <Icons.Copy size={16} className="text-joy-gray-500" />
                                </button>
                                <button onClick={() => handleDeletePage(page.id)} className="p-2 hover:bg-red-50 rounded-lg" title="Delete">
                                  <Icons.Trash2 size={16} className="text-red-500" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shipping Tab */}
          {activeTab === 'shipping' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div><h2 className="font-semibold text-lg text-joy-gray-900">Shipping Methods</h2><p className="text-sm text-joy-gray-500 mt-1">Configure carriers and shipping rates</p></div>
                  <Button onClick={openAddShipping}><Icons.Plus size={18} className="mr-2" />Add Shipping Method</Button>
                </div>
                {shippingMethods.length === 0 ? (
                  <p className="text-center text-joy-gray-500 py-8">No shipping methods configured. Add one to get started.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-joy-gray-50">
                        <tr>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Method</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Code</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Base Cost</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Per Kg</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Free At</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Days</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Status</th>
                          <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-joy-gray-100">
                        {shippingMethods.map(m => (
                          <tr key={m.id} className="hover:bg-joy-gray-50">
                            <td className="px-4 py-3 font-medium text-joy-gray-900">{m.name}</td>
                            <td className="px-4 py-3 font-mono text-sm text-joy-gray-600">{m.code}</td>
                            <td className="px-4 py-3 text-joy-gray-700">${m.baseCost.toFixed(2)}</td>
                            <td className="px-4 py-3 text-joy-gray-700">${m.costPerKg.toFixed(2)}/kg</td>
                            <td className="px-4 py-3 text-joy-gray-700">{m.freeThreshold > 0 ? `$${m.freeThreshold}` : '-'}</td>
                            <td className="px-4 py-3 text-joy-gray-700">{m.estimatedDays || '-'}</td>
                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${m.isActive ? 'bg-joy-green/10 text-joy-green' : 'bg-joy-gray-100 text-joy-gray-600'}`}>{m.isActive ? 'Active' : 'Inactive'}</span></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditShipping(m)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.Copy size={16} className="text-joy-gray-500" /></button>
                                <button onClick={() => handleDeleteShipping(m.id)} className="p-2 hover:bg-red-50 rounded-lg"><Icons.Trash2 size={16} className="text-red-500" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
              <h2 className="font-display text-lg font-bold text-joy-gray-900">{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="Category Name *" placeholder="e.g., Electronics" value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} />
              <Input label="Slug" placeholder="electronics" value={categoryForm.slug} onChange={e => setCategoryForm({...categoryForm, slug: e.target.value})} />
              <Input label="Description" placeholder="Optional" value={categoryForm.description} onChange={e => setCategoryForm({...categoryForm, description: e.target.value})} />
              <div><label className="block text-sm font-medium text-joy-gray-700 mb-2">Parent Category</label>
                <select className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" value={categoryForm.parentId} onChange={e => setCategoryForm({...categoryForm, parentId: e.target.value})}>
                  <option value="">-- Main Category --</option>
                  {categories.filter(c => c.id !== editingCategory?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

      {/* Custom Page Modal */}
      {showPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPageModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b border-joy-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-joy-gray-900">{editingPage ? 'Edit Page' : 'Add New Page'}</h2>
                <p className="text-sm text-joy-gray-500">WordPress-style page editor</p>
              </div>
              <button onClick={() => setShowPageModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-medium text-joy-gray-900">Basic Information</h3>
                <Input label="Page Title *" placeholder="e.g., Privacy Policy" value={pageForm.title} onChange={e => setPageForm({...pageForm, title: e.target.value})} />
                <Input label="URL Slug *" placeholder="privacy-policy" value={pageForm.slug} onChange={e => setPageForm({...pageForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} />
                <Input label="Excerpt (Short Description)" placeholder="Brief description for SEO and listings" value={pageForm.excerpt} onChange={e => setPageForm({...pageForm, excerpt: e.target.value})} />
              </div>
              
              {/* Featured Image */}
              <div className="space-y-4">
                <h3 className="font-medium text-joy-gray-900">Featured Image</h3>
                <Input label="Featured Image URL" placeholder="https://example.com/image.jpg" value={pageForm.featuredImage} onChange={e => setPageForm({...pageForm, featuredImage: e.target.value})} />
              </div>
              
              {/* Template */}
              <div className="space-y-4">
                <h3 className="font-medium text-joy-gray-900">Page Template</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { value: 'default', label: 'Default', desc: 'Standard layout' },
                    { value: 'full-width', label: 'Full Width', desc: 'No max-width' },
                    { value: 'sidebar', label: 'With Sidebar', desc: 'Quick links sidebar' },
                    { value: 'landing', label: 'Landing', desc: 'Hero + content' },
                  ].map(t => (
                    <button
                      key={t.value}
                      onClick={() => setPageForm({...pageForm, template: t.value})}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${pageForm.template === t.value ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-gray-300'}`}
                    >
                      <div className="font-medium text-sm text-joy-gray-900">{t.label}</div>
                      <div className="text-xs text-joy-gray-500">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Content */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-joy-gray-900">Page Content (HTML) *</h3>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="imageUpload"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const formData = new FormData()
                        formData.append('file', file)
                        try {
                          const res = await fetch('/api/upload', { method: 'POST', body: formData })
                          const data = await res.json()
                          if (data.success) {
                            const imgTag = `<img src="${data.url}" alt="${file.name}" style="max-width:100%;height:auto;" />`
                            setPageForm({...pageForm, content: pageForm.content + imgTag})
                          } else {
                            alert(data.error || 'Upload failed')
                          }
                        } catch { alert('Upload failed') }
                        e.target.value = ''
                      }}
                    />
                    <label
                      htmlFor="imageUpload"
                      className="px-3 py-1.5 bg-joy-gray-100 hover:bg-joy-gray-200 rounded-lg text-sm font-medium text-joy-gray-700 cursor-pointer flex items-center gap-1.5"
                    >
                      <Icons.Package size={16} /> Upload Image
                    </label>
                  </div>
                </div>
                
                {/* Simple WYSIWYG Toolbar */}
                <div className="border-2 border-joy-gray-200 rounded-xl overflow-hidden focus-within:border-joy-orange">
                  <div className="bg-joy-gray-50 px-3 py-2 flex flex-wrap gap-1 border-b border-joy-gray-200">
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<h2></h2>'})} className="px-2 py-1 text-sm font-bold hover:bg-joy-gray-200 rounded">H2</button>
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<h3></h3>'})} className="px-2 py-1 text-sm font-bold hover:bg-joy-gray-200 rounded">H3</button>
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<p></p>'})} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">P</button>
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<strong></strong>'})} className="px-2 py-1 text-sm font-bold hover:bg-joy-gray-200 rounded">B</button>
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<em></em>'})} className="px-2 py-1 text-sm italic hover:bg-joy-gray-200 rounded">I</button>
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<ul><li></li></ul>'})} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">• List</button>
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<ol><li></li></ol>'})} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">1. List</button>
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<a href=""></a>'})} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">Link</button>
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<hr/>'})} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">HR</button>
                    <button type="button" onClick={() => setPageForm({...pageForm, content: pageForm.content + '<blockquote></blockquote>'})} className="px-2 py-1 text-sm italic hover:bg-joy-gray-200 rounded">Quote</button>
                  </div>
                  <textarea
                    className="w-full px-4 py-3 min-h-[250px] font-mono text-sm border-0 focus:ring-0"
                    placeholder="<h2>Your Content</h2>&#10;<p>Write your page content here with HTML formatting...</p>&#10;&#10;<p>Use the toolbar above or write HTML directly.</p>"
                    value={pageForm.content}
                    onChange={e => setPageForm({...pageForm, content: e.target.value})}
                  />
                </div>
                
                {/* Content Preview */}
                {pageForm.content && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-joy-gray-700 mb-2">Preview:</h4>
                    <div className="border rounded-xl p-4 bg-white">
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: pageForm.content }} />
                    </div>
                  </div>
                )}
              </div>
              
              {/* SEO */}
              <div className="space-y-4 bg-joy-gray-50 rounded-xl p-4">
                <h3 className="font-medium text-joy-gray-900">SEO Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Meta Title" placeholder="Page title for search engines" value={pageForm.metaTitle} onChange={e => setPageForm({...pageForm, metaTitle: e.target.value})} />
                  <Input label="Meta Description" placeholder="Brief description for search results" value={pageForm.metaDesc} onChange={e => setPageForm({...pageForm, metaDesc: e.target.value})} />
                </div>
              </div>
              
              {/* Publish Status */}
              <div className="space-y-4">
                <h3 className="font-medium text-joy-gray-900">Publish Settings</h3>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      id="statusDraft" 
                      name="pageStatus" 
                      value="draft"
                      checked={pageForm.status === 'draft'}
                      onChange={() => setPageForm({...pageForm, status: 'draft', isActive: false})}
                      className="rounded"
                    />
                    <label htmlFor="statusDraft" className="text-sm text-joy-gray-700">Draft</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      id="statusPublished" 
                      name="pageStatus" 
                      value="published"
                      checked={pageForm.status === 'published'}
                      onChange={() => setPageForm({...pageForm, status: 'published', isActive: true})}
                      className="rounded"
                    />
                    <label htmlFor="statusPublished" className="text-sm text-joy-gray-700">Published</label>
                  </div>
                </div>
                <p className="text-sm text-joy-gray-500">
                  {pageForm.status === 'draft' 
                    ? 'Page is saved but not visible on the site.' 
                    : 'Page is live and visible on the site.'}
                </p>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-joy-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowPageModal(false)}>Cancel</Button>
              <Button onClick={handlePageSubmit} isLoading={isSaving}>
                {pageForm.status === 'published' ? 'Publish Page' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Modal */}
      {showShippingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowShippingModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b border-joy-gray-100 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-joy-gray-900">{editingShipping ? 'Edit Shipping Method' : 'Add Shipping Method'}</h2>
              <button onClick={() => setShowShippingModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Method Name *" placeholder="e.g., DHL Express" value={shippingForm.name} onChange={e => setShippingForm({...shippingForm, name: e.target.value})} />
                <Input label="Code *" placeholder="DHL" value={shippingForm.code} onChange={e => setShippingForm({...shippingForm, code: e.target.value})} />
              </div>
              <Input label="Description" placeholder="Optional description" value={shippingForm.description} onChange={e => setShippingForm({...shippingForm, description: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Base Cost (USD) *" type="number" placeholder="5.99" value={shippingForm.baseCost} onChange={e => setShippingForm({...shippingForm, baseCost: e.target.value})} />
                <Input label="Cost per KG (USD) *" type="number" placeholder="2.50" value={shippingForm.costPerKg} onChange={e => setShippingForm({...shippingForm, costPerKg: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Free Shipping Threshold (USD)" type="number" placeholder="199" value={shippingForm.freeThreshold} onChange={e => setShippingForm({...shippingForm, freeThreshold: e.target.value})} />
                <Input label="Estimated Days" placeholder="7-15 days" value={shippingForm.estimatedDays} onChange={e => setShippingForm({...shippingForm, estimatedDays: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Min Weight (kg)" type="number" placeholder="0" value={shippingForm.minWeight} onChange={e => setShippingForm({...shippingForm, minWeight: e.target.value})} />
                <Input label="Max Weight (kg, 0=unlimited)" type="number" placeholder="0" value={shippingForm.maxWeight} onChange={e => setShippingForm({...shippingForm, maxWeight: e.target.value})} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={shippingForm.isActive} onChange={e => setShippingForm({...shippingForm, isActive: e.target.checked})} className="rounded" />
                <label htmlFor="isActive" className="text-sm text-joy-gray-700">Active</label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-joy-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowShippingModal(false)}>Cancel</Button>
              <Button onClick={handleShippingSubmit} isLoading={isSaving}>{editingShipping ? 'Update' : 'Add Method'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

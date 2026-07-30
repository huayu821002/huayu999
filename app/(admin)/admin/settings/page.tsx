'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { SHIPPING_ZONES } from '@/lib/shipping-zones'

interface SiteContent {
  id: string; section: string; title: string | null; subtitle: string | null; content: string | null; isActive: boolean; sortOrder: number
}
interface Category { id: string; name: string; slug: string; description: string | null; parentId: string | null; image?: string | null; productCount?: number }
interface CategoryNode extends Category { children: CategoryNode[] }
interface ShippingMethod {
  id: string; name: string; code: string; description: string | null
  baseCost: number; costPerKg: number; freeThreshold: number
  minWeight: number; maxWeight: number; estimatedDays: string | null
  isActive: boolean; sortOrder: number
}

const HOMEPAGE_SECTIONS = [
  { key: 'trust_badges', label: 'Trust Badges' },
]

const PAGE_SECTIONS = []

export default function AdminSettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'homepage' | 'shipping' | 'payments' | 'custom_pages' | 'header_footer' | 'seo'>('general')

  // Categories
  const [categories, setCategories] = useState<Category[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState<{ id?: string; name: string; slug: string; description: string; parentId: string; image: string }>({ name: '', slug: '', description: '', parentId: '', image: '' })

  // Homepage
  const [homepageContent, setHomepageContent] = useState<Record<string, SiteContent>>({})
  const [homepageForm, setHomepageForm] = useState<Record<string, { title: string; subtitle: string; content: string }>>({})

  // Shipping Templates
  const [shippingTemplates, setShippingTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [shippingRates, setShippingRates] = useState<any[]>([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [templateForm, setTemplateForm] = useState({ name: '', code: '', description: '', isActive: true, sortOrder: '0' })
  const [showRateModal, setShowRateModal] = useState(false)
  const [editingRate, setEditingRate] = useState<any>(null)
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [rateForm, setRateForm] = useState({ countryCode: '', countryName: '', baseCost: '0', costPerKg: '0', freeThreshold: '0', minWeight: '0', maxWeight: '0', estimatedDays: '', isActive: true, sortOrder: '0' })

  // Custom Pages
  const [customPages, setCustomPages] = useState<any[]>([])
  const [showPageModal, setShowPageModal] = useState(false)
  const [editingPage, setEditingPage] = useState<any | null>(null)
  const [pageForm, setPageForm] = useState({
    title: '', slug: '', excerpt: '', content: '', featuredImage: '', template: 'default',
    metaTitle: '', metaDesc: '', status: 'draft', isActive: false, sortOrder: '0'
  })

  // Header & Footer Settings
  const [headerSettings, setHeaderSettings] = useState<any>(null)
  const [footerSettings, setFooterSettings] = useState<any>(null)
  const [seoSettings, setSeoSettings] = useState<{ title: string; description: string; keywords: string; ogImage: string }>({ title: '', description: '', keywords: '', ogImage: '' })

  // Payment Settings
  const [paymentSettings, setPaymentSettings] = useState<any>(null)

  // Category Settings
  const [homepageCategoryForm, setHomepageCategoryForm] = useState<any[]>([
    { id: 'cat-1', name: 'Accessories', slug: 'accessories', image: '' },
    { id: 'cat-2', name: 'Pet Supplies', slug: 'pet-supplies', image: '' },
    { id: 'cat-3', name: 'Home Decor', slug: 'home-decor', image: '' },
    { id: 'cat-4', name: 'Gifts', slug: 'gifts', image: '' },
  ])

  // Trust Badge Settings
  const [trustBadgeForm, setTrustBadgeForm] = useState<any[]>([
    { icon: 'ShieldCheck', title: 'Quality Assured', desc: 'Every product inspected before shipping' },
    { icon: 'Truck', title: 'Global Shipping', desc: '150+ countries supported' },
    { icon: 'Package', title: 'Low Minimums', desc: 'Order from just 3 units' },
    { icon: 'RefreshCw', title: 'Easy Returns', desc: '30-day hassle-free returns' },
  ])
  const [footerPromoForm, setFooterPromoForm] = useState<any>({ social: ['Instagram', 'Facebook', 'Twitter', 'YouTube', 'TikTok'] })

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
    if (activeTab === 'shipping') { fetchShippingTemplates(); fetchShippingRates() }
    if (activeTab === 'payments') fetchPaymentSettings()
    if (activeTab === 'custom_pages') fetchCustomPages()
    if (activeTab === 'header_footer') fetchHeaderFooter()
    if (activeTab === 'seo') fetchSeoSettings()
    if (activeTab === 'homepage') {
      fetchHomepageCategories()
      fetchTrustBadges()
    }
  }, [isAdmin, activeTab])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/product-categories')
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

  const fetchShippingTemplates = async () => {
    try {
      const res = await fetch('/api/admin/shipping-methods')
      const data = await res.json()
      if (data.success) setShippingTemplates(data.data)
    } catch (err) { console.error(err) }
  }

  const fetchShippingRates = async (methodId?: string) => {
    try {
      const url = methodId ? `/api/admin/shipping-rates?methodId=${methodId}` : '/api/admin/shipping-rates'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) setShippingRates(data.data)
    } catch (err) { console.error(err) }
  }

  const selectTemplate = async (tmpl: any) => {
    setSelectedTemplate(tmpl)
    await fetchShippingRates(tmpl.id)
  }

  const fetchSeoSettings = async () => {
    try {
      const res = await fetch('/api/admin/seo')
      const data = await res.json()
      if (data.success) setSeoSettings(data.data)
    } catch (err) { console.error(err) }
  }

  const fetchCustomPages = async () => {
    try {
      const res = await fetch('/api/admin/pages')
      const data = await res.json()
      if (data.success) setCustomPages(data.data)
    } catch (err) { console.error(err) }
  }

  const fetchHeaderFooter = async () => {
    try {
      const res = await fetch('/api/admin/header-footer')
      const data = await res.json()
      if (data.success) {
        setHeaderSettings(data.data.header)
        setFooterSettings(data.data.footer)
      }
    } catch (err) { console.error(err) }
  }

  const saveHeaderFooter = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/header-footer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ header: headerSettings, footer: footerSettings })
      })
      if (res.ok) {
        alert('保存成功！')
      } else {
        alert('保存失败')
      }
    } catch (err) { console.error(err); alert('保存失败') }
    finally { setIsSaving(false) }
  }

  const fetchHomepageCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      if (data.success && data.data) {
        setHomepageCategoryForm(data.data)
      }
    } catch (err) { console.error(err) }
  }

  const saveCategories = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(homepageCategoryForm)
      })
      if (res.ok) {
        alert('Categories saved successfully!')
      } else {
        alert('Failed to save categories')
      }
    } catch (err) { console.error(err); alert('Failed to save categories') }
    finally { setIsSaving(false) }
  }

  const fetchTrustBadges = async () => {
    try {
      const res = await fetch('/api/admin/homepage-blocks')
      const data = await res.json()
      if (data.success && data.data) {
        if (data.data.trustBadges) setTrustBadgeForm(data.data.trustBadges)
        if (data.data.footerPromo) setFooterPromoForm(data.data.footerPromo)
      }
    } catch (err) { console.error(err) }
  }

  const saveTrustBadges = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/homepage-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustBadges: trustBadgeForm, footerPromo: footerPromoForm })
      })
      if (res.ok) {
        alert('Trust badges and footer promo saved successfully!')
      } else {
        alert('Failed to save')
      }
    } catch (err) { console.error(err); alert('Failed to save') }
    finally { setIsSaving(false) }
  }

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch('/api/admin/payment-settings')
      const data = await res.json()
      if (data.success && data.data) {
        setPaymentSettings(data.data)
      }
    } catch (err) { console.error(err) }
  }

  const saveSeoSettings = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seoSettings)
      })
      if (res.ok) {
        alert('SEO settings saved successfully!')
      }
    } catch (err) { console.error(err) }
    setIsSaving(false)
  }

  const savePaymentSettings = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentSettings)
      })
      if (res.ok) {
        alert('Payment settings saved successfully!')
      } else {
        alert('Failed to save')
      }
    } catch (err) { console.error(err); alert('Failed to save') }
    finally { setIsSaving(false) }
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
  const buildTree = (cats: Category[], parentId: string | null = null): CategoryNode[] => cats.filter(c => (c.parentId || null) === parentId).map(c => ({ ...c, children: buildTree(cats, c.id) }))
  const flattenTree = (nodes: CategoryNode[], depth = 0): { cat: CategoryNode; depth: number }[] => nodes.flatMap(node => [{ cat: node, depth }, ...flattenTree(node.children, depth + 1)])

  const handleSave = () => { setIsSaving(true); setTimeout(() => setIsSaving(false), 1000) }

  // Category handlers
  const openAddCategory = (parentId?: string) => { setEditingCategory(null); setCategoryForm({ name: '', slug: '', description: '', parentId: parentId || '', image: '' }); setShowCategoryModal(true) }
  const openEditCategory = (cat: Category) => { setEditingCategory(cat); setCategoryForm({ id: cat.id, name: cat.name, slug: cat.slug, description: cat.description || '', parentId: cat.parentId || '', image: cat.image || '' }); setShowCategoryModal(true) }
  const handleCategorySubmit = async () => {
    if (!categoryForm.name) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/product-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(categoryForm) })
      const data = await res.json()
      if (data.success) { setShowCategoryModal(false); fetchCategories() } else alert(data.error)
    } catch { alert('Failed to save category') }
    setIsSaving(false)
  }

  // Shipping handlers
  // Template handlers
  const openAddTemplate = () => { setEditingTemplate(null); setTemplateForm({ name: '', code: '', description: '', isActive: true, sortOrder: String(shippingTemplates.length) }); setShowTemplateModal(true) }
  const openEditTemplate = (t: any) => { setEditingTemplate(t); setTemplateForm({ name: t.name, code: t.code, description: t.description || '', isActive: t.isActive, sortOrder: String(t.sortOrder || 0) }); setShowTemplateModal(true) }
  const handleTemplateSubmit = async () => {
    if (!templateForm.name || !templateForm.code) return
    setIsSaving(true)
    try {
      const url = editingTemplate ? `/api/admin/shipping-methods/${editingTemplate.id}` : '/api/admin/shipping-methods'
      const method = editingTemplate ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(templateForm) })
      const data = await res.json()
      if (data.success) { setShowTemplateModal(false); fetchShippingTemplates() } else alert(data.error)
    } catch { alert('Failed to save template') }
    setIsSaving(false)
  }
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    try {
      await fetch(`/api/admin/shipping-methods/${id}`, { method: 'DELETE' })
      if (selectedTemplate?.id === id) setSelectedTemplate(null)
      fetchShippingTemplates()
    } catch { alert('Failed to delete') }
  }

  // Rate handlers
  const openAddRate = () => { setEditingRate(null); setSelectedCountries([]); setRateForm({ countryCode: '', countryName: '', baseCost: '0', costPerKg: '0', freeThreshold: '0', minWeight: '0', maxWeight: '0', estimatedDays: '', isActive: true, sortOrder: '0' }); setShowRateModal(true) }
  const openEditRate = (r: any) => { setEditingRate(r); setSelectedCountries([r.countryCode]); setRateForm({ countryCode: r.countryCode, countryName: r.countryName, baseCost: String(r.baseCost), costPerKg: String(r.costPerKg), freeThreshold: String(r.freeThreshold), minWeight: String(r.minWeight || 0), maxWeight: String(r.maxWeight || 0), estimatedDays: r.estimatedDays || '', isActive: r.isActive, sortOrder: String(r.sortOrder || 0) }); setShowRateModal(true) }
  const handleRateSubmit = async () => {
    if (selectedCountries.length === 0) {
      alert('Please select at least one country')
      return
    }
    setIsSaving(true)
    try {
      if (editingRate) {
        // Editing single rate
        const body = { ...rateForm, methodId: selectedTemplate?.id || null }
        const res = await fetch(`/api/admin/shipping-rates/${editingRate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const data = await res.json()
        if (!data.success) alert(data.error)
      } else {
        // Creating multiple rates (one per country)
        const results = { success: 0, failed: 0, errors: [] as string[] }
        for (const countryCode of selectedCountries) {
          const countryName = SHIPPING_ZONES.flatMap(z => z.countries).find(c => c.code === countryCode)?.name || countryCode
          const body = {
            countryCode,
            countryName,
            baseCost: rateForm.baseCost,
            costPerKg: rateForm.costPerKg,
            freeThreshold: rateForm.freeThreshold,
            minWeight: rateForm.minWeight,
            maxWeight: rateForm.maxWeight,
            estimatedDays: rateForm.estimatedDays,
            isActive: rateForm.isActive,
            methodId: selectedTemplate?.id || null
          }
          const res = await fetch('/api/admin/shipping-rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
          const data = await res.json()
          if (data.success) results.success++
          else {
            results.failed++
            results.errors.push(`${countryCode}: ${data.error}`)
          }
        }
        if (results.failed > 0) {
          alert(`Added: ${results.success}, Failed: ${results.failed}\n${results.errors.slice(0, 3).join('\n')}`)
        }
      }
      setShowRateModal(false)
      fetchShippingRates(selectedTemplate?.id)
    } catch { alert('Failed to save rate') }
    setIsSaving(false)
  }
  const handleDeleteRate = async (id: string) => {
    if (!confirm('Delete this rate?')) return
    try {
      await fetch(`/api/admin/shipping-rates/${id}`, { method: 'DELETE' })
      fetchShippingRates(selectedTemplate?.id)
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
            {[{ key: 'general', label: 'General' }, { key: 'categories', label: `Categories (${categories.length})` }, { key: 'homepage', label: 'Homepage' }, { key: 'shipping', label: `Shipping (${shippingTemplates.length})` }, { key: 'payments', label: 'Payments' }, { key: 'custom_pages', label: 'Custom Pages' }, { key: 'header_footer', label: 'Header & Footer' }, { key: 'seo', label: 'SEO' }].map(tab => (
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
                          <button onClick={() => { if (confirm(`Delete category "${cat.name}"?`)) { fetch(`/api/admin/product-categories?id=${cat.id}`, { method: 'DELETE' }).then(r => r.json()).then(d => d.success ? fetchCategories() : alert(d.error)) } }} className="p-2 hover:bg-red-50 rounded-lg text-red-400"><Icons.Trash2 size={16} /></button>
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

              {/* Shop by Category Section */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-lg text-joy-gray-900">Shop by Category</h2>
                    <p className="text-sm text-joy-gray-500 mt-1">Custom homepage category blocks - image, name, and link</p>
                  </div>
                  <Button size="sm" onClick={saveCategories} isLoading={isSaving}>Save All</Button>
                </div>
                <div className="space-y-4">
                  {homepageCategoryForm.map((cat, idx) => (
                    <div key={cat.id} className="border border-joy-gray-200 rounded-xl p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-joy-gray-700 mb-1">Name</label>
                          <input type="text" className="w-full px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={cat.name} onChange={e => { const updated = [...homepageCategoryForm]; updated[idx].name = e.target.value; setHomepageCategoryForm(updated); }} placeholder="Category name" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-joy-gray-700 mb-1">Link URL</label>
                          <input type="text" className="w-full px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={cat.slug} onChange={e => { const updated = [...homepageCategoryForm]; updated[idx].slug = e.target.value; setHomepageCategoryForm(updated); }} placeholder="/products or https://..." />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-sm font-medium text-joy-gray-700 mb-1">Image URL</label>
                          <input type="text" className="w-full px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={cat.image} onChange={e => { const updated = [...homepageCategoryForm]; updated[idx].image = e.target.value; setHomepageCategoryForm(updated); }} placeholder="https://images.unsplash.com/..." />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust Badges Section */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-lg text-joy-gray-900">Trust Badges</h2>
                    <p className="text-sm text-joy-gray-500 mt-1">Edit icons below carousel and in footer</p>
                  </div>
                  <Button size="sm" onClick={saveTrustBadges} isLoading={isSaving}>Save All</Button>
                </div>
                <div className="space-y-4">
                  {trustBadgeForm.map((badge, idx) => (
                    <div key={idx} className="border border-joy-gray-200 rounded-xl p-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-joy-gray-700 mb-1">Icon</label>
                          <select className="w-full px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={badge.icon} onChange={e => { const updated = [...trustBadgeForm]; updated[idx].icon = e.target.value; setTrustBadgeForm(updated); }}>
                            <option value="ShieldCheck">ShieldCheck</option>
                            <option value="Truck">Truck</option>
                            <option value="Package">Package</option>
                            <option value="RefreshCw">RefreshCw</option>
                            <option value="MessageCircle">MessageCircle</option>
                            <option value="Star">Star</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-joy-gray-700 mb-1">Title</label>
                          <input type="text" className="w-full px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={badge.title} onChange={e => { const updated = [...trustBadgeForm]; updated[idx].title = e.target.value; setTrustBadgeForm(updated); }} />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-joy-gray-700 mb-1">Description</label>
                          <input type="text" className="w-full px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={badge.desc} onChange={e => { const updated = [...trustBadgeForm]; updated[idx].desc = e.target.value; setTrustBadgeForm(updated); }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Promo Section */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-lg text-joy-gray-900">Footer Social Links</h2>
                    <p className="text-sm text-joy-gray-500 mt-1">Edit footer social media icons</p>
                  </div>
                  <Button size="sm" onClick={saveTrustBadges} isLoading={isSaving}>Save All</Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Enabled Social Platforms</label>
                    <div className="flex flex-wrap gap-2">
                      {['Instagram', 'Facebook', 'Twitter', 'YouTube', 'TikTok'].map(social => (
                        <label key={social} className="flex items-center gap-2 px-3 py-2 border border-joy-gray-200 rounded-lg cursor-pointer hover:bg-joy-gray-50">
                          <input type="checkbox" checked={footerPromoForm.social.includes(social)} onChange={e => {
                            if (e.target.checked) {
                              setFooterPromoForm({ ...footerPromoForm, social: [...footerPromoForm.social, social] })
                            } else {
                              setFooterPromoForm({ ...footerPromoForm, social: footerPromoForm.social.filter((s: string) => s !== social) })
                            }
                          }} className="rounded" />
                          <span className="text-sm">{social}</span>
                        </label>
                      ))}
                    </div>
                  </div>
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
                                <a href={`/info/${page.slug}`} target="_blank" className="p-2 hover:bg-joy-gray-100 rounded-lg" title="View Page">
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
            <div className="flex gap-6 min-h-[500px]">
              {/* Left: Template List */}
              <div className="w-80 flex-shrink-0 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-joy-gray-900">Templates</h2>
                    <button onClick={openAddTemplate} className="p-1.5 bg-joy-orange text-white rounded-lg hover:bg-joy-orange/90"><Icons.Plus size={16} /></button>
                  </div>
                  {shippingTemplates.length === 0 ? (
                    <p className="text-sm text-joy-gray-500 text-center py-6">No templates yet.<br />Create one to start.</p>
                  ) : (
                    <div className="space-y-2">
                      {shippingTemplates.map(t => (
                        <div key={t.id} onClick={() => selectTemplate(t)}
                          className={`p-3 rounded-xl cursor-pointer border-2 transition-colors ${selectedTemplate?.id === t.id ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-100 hover:border-joy-gray-200'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-joy-gray-900 text-sm">{t.name}</p>
                              <p className="text-xs text-joy-gray-500 font-mono">{t.code}</p>
                              <p className="text-xs text-joy-gray-400 mt-0.5">{t._count?.rates || 0} countries</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${t.isActive ? 'bg-joy-green' : 'bg-joy-gray-300'}`} />
                              <button onClick={(e) => { e.stopPropagation(); openEditTemplate(t) }} className="p-1 hover:bg-joy-gray-100 rounded"><Icons.Copy size={14} className="text-joy-gray-400" /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id) }} className="p-1 hover:bg-red-50 rounded"><Icons.Trash2 size={14} className="text-red-400" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Rates for selected template */}
              <div className="flex-1 bg-white rounded-2xl shadow-sm p-6">
                {selectedTemplate ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="font-semibold text-lg text-joy-gray-900">{selectedTemplate.name}</h2>
                        <p className="text-sm text-joy-gray-500 mt-1">Country rates for this template</p>
                      </div>
                      <Button onClick={openAddRate}><Icons.Plus size={18} className="mr-2" />Add Country</Button>
                    </div>
                    {shippingRates.length === 0 ? (
                      <p className="text-center text-joy-gray-500 py-12">No country rates yet. Click "Add Country" to create one.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-joy-gray-50">
                            <tr>
                              <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Country</th>
                              <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Base</th>
                              <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Per Kg</th>
                              <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Free At</th>
                              <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Weight</th>
                              <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Days</th>
                              <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Status</th>
                              <th className="text-left text-xs font-medium text-joy-gray-500 uppercase px-4 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-joy-gray-100">
                            {shippingRates.map(r => (
                              <tr key={r.id} className="hover:bg-joy-gray-50">
                                <td className="px-4 py-3">
                                  <p className="font-medium text-joy-gray-900">{r.countryName}</p>
                                  <p className="text-xs text-joy-gray-500 font-mono">{r.countryCode}</p>
                                </td>
                                <td className="px-4 py-3 text-joy-gray-700">${Number(r.baseCost).toFixed(2)}</td>
                                <td className="px-4 py-3 text-joy-gray-700">${Number(r.costPerKg).toFixed(2)}/kg</td>
                                <td className="px-4 py-3 text-joy-gray-700">{Number(r.freeThreshold) > 0 ? `$${r.freeThreshold}` : '-'}</td>
                                <td className="px-4 py-3 text-joy-gray-700 text-xs">{r.minWeight > 0 || r.maxWeight > 0 ? `${r.minWeight || 0}-${r.maxWeight || '∞'}kg` : '-'}</td>
                                <td className="px-4 py-3 text-joy-gray-700">{r.estimatedDays || '-'}</td>
                                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${r.isActive ? 'bg-joy-green/10 text-joy-green' : 'bg-joy-gray-100 text-joy-gray-600'}`}>{r.isActive ? 'Active' : 'Inactive'}</span></td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => openEditRate(r)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.Copy size={16} className="text-joy-gray-500" /></button>
                                    <button onClick={() => handleDeleteRate(r.id)} className="p-2 hover:bg-red-50 rounded-lg"><Icons.Trash2 size={16} className="text-red-500" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <Icons.Truck size={48} className="text-joy-gray-200 mb-4" />
                    <p className="text-joy-gray-500 font-medium">Select a template to view its country rates</p>
                    <p className="text-joy-gray-400 text-sm mt-1">Or create a new template to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && paymentSettings && (
            <div className="space-y-6">
              {/* Mode Toggle */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-2">Payment Mode</h2>
                <p className="text-sm text-joy-gray-500 mb-6">Switch between sandbox (testing) and production (live) modes</p>
                <div className="flex items-center gap-4">
                  <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${paymentSettings.mode === 'sandbox' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-gray-300'}`}>
                    <input type="radio" name="mode" checked={paymentSettings.mode === 'sandbox'} onChange={() => setPaymentSettings({ ...paymentSettings, mode: 'sandbox' })} className="accent-joy-orange" />
                    <div>
                      <span className="font-medium">Sandbox</span>
                      <p className="text-xs text-joy-gray-500">Testing mode (simulated payments)</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${paymentSettings.mode === 'production' ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-200 hover:border-joy-gray-300'}`}>
                    <input type="radio" name="mode" checked={paymentSettings.mode === 'production'} onChange={() => setPaymentSettings({ ...paymentSettings, mode: 'production' })} className="accent-joy-orange" />
                    <div>
                      <span className="font-medium">Production</span>
                      <p className="text-xs text-joy-gray-500">Live mode (real payments)</p>
                    </div>
                  </label>
                </div>
                {paymentSettings.mode === 'sandbox' && (
                  <p className="mt-4 text-sm text-joy-orange bg-joy-orange/10 rounded-lg px-4 py-2">⚠️ Sandbox mode is active. No real money will be processed.</p>
                )}
              </div>

              {/* PayPal Settings */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-lg text-joy-gray-900">PayPal</h2>
                    <p className="text-sm text-joy-gray-500 mt-1">Configure PayPal payment settings</p>
                  </div>
                  <label className="flex items-center gap-2">
                    <span className="text-sm text-joy-gray-600">{paymentSettings.paypal?.enabled ? 'Enabled' : 'Disabled'}</span>
                    <button onClick={() => setPaymentSettings({ ...paymentSettings, paypal: { ...paymentSettings.paypal, enabled: !paymentSettings.paypal?.enabled } })} className={`w-12 h-6 rounded-full transition-colors ${paymentSettings.paypal?.enabled ? 'bg-joy-orange' : 'bg-joy-gray-300'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${paymentSettings.paypal?.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Sandbox Client ID</label>
                      <input type="text" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="sb-xxxxx" value={paymentSettings.paypal?.sandbox?.clientId || ''} onChange={e => setPaymentSettings({ ...paymentSettings, paypal: { ...paymentSettings.paypal, sandbox: { ...paymentSettings.paypal?.sandbox, clientId: e.target.value } } })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Sandbox Client Secret</label>
                      <input type="password" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="xxxxx" value={paymentSettings.paypal?.sandbox?.clientSecret || ''} onChange={e => setPaymentSettings({ ...paymentSettings, paypal: { ...paymentSettings.paypal, sandbox: { ...paymentSettings.paypal?.sandbox, clientSecret: e.target.value } } })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Production Client ID</label>
                      <input type="text" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="xxxxx" value={paymentSettings.paypal?.production?.clientId || ''} onChange={e => setPaymentSettings({ ...paymentSettings, paypal: { ...paymentSettings.paypal, production: { ...paymentSettings.paypal?.production, clientId: e.target.value } } })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Production Client Secret</label>
                      <input type="password" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="xxxxx" value={paymentSettings.paypal?.production?.clientSecret || ''} onChange={e => setPaymentSettings({ ...paymentSettings, paypal: { ...paymentSettings.paypal, production: { ...paymentSettings.paypal?.production, clientSecret: e.target.value } } })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stripe Settings */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-lg text-joy-gray-900">Stripe</h2>
                    <p className="text-sm text-joy-gray-500 mt-1">Configure Stripe payment settings</p>
                  </div>
                  <label className="flex items-center gap-2">
                    <span className="text-sm text-joy-gray-600">{paymentSettings.stripe?.enabled ? 'Enabled' : 'Disabled'}</span>
                    <button onClick={() => setPaymentSettings({ ...paymentSettings, stripe: { ...paymentSettings.stripe, enabled: !paymentSettings.stripe?.enabled } })} className={`w-12 h-6 rounded-full transition-colors ${paymentSettings.stripe?.enabled ? 'bg-joy-orange' : 'bg-joy-gray-300'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${paymentSettings.stripe?.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Sandbox Publishable Key</label>
                      <input type="text" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="pk_test_xxxxx" value={paymentSettings.stripe?.sandbox?.publishableKey || ''} onChange={e => setPaymentSettings({ ...paymentSettings, stripe: { ...paymentSettings.stripe, sandbox: { ...paymentSettings.stripe?.sandbox, publishableKey: e.target.value } } })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Sandbox Secret Key</label>
                      <input type="password" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="sk_test_xxxxx" value={paymentSettings.stripe?.sandbox?.secretKey || ''} onChange={e => setPaymentSettings({ ...paymentSettings, stripe: { ...paymentSettings.stripe, sandbox: { ...paymentSettings.stripe?.sandbox, secretKey: e.target.value } } })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Production Publishable Key</label>
                      <input type="text" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="pk_live_xxxxx" value={paymentSettings.stripe?.production?.publishableKey || ''} onChange={e => setPaymentSettings({ ...paymentSettings, stripe: { ...paymentSettings.stripe, production: { ...paymentSettings.stripe?.production, publishableKey: e.target.value } } })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Production Secret Key</label>
                      <input type="password" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="sk_live_xxxxx" value={paymentSettings.stripe?.production?.secretKey || ''} onChange={e => setPaymentSettings({ ...paymentSettings, stripe: { ...paymentSettings.stripe, production: { ...paymentSettings.stripe?.production, secretKey: e.target.value } } })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1">Webhook Secret</label>
                    <input type="password" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="whsec_xxxxx" value={paymentSettings.stripe?.webhookSecret || ''} onChange={e => setPaymentSettings({ ...paymentSettings, stripe: { ...paymentSettings.stripe, webhookSecret: e.target.value } })} />
                  </div>
                </div>
              </div>

              {/* Bank Transfer Settings */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-lg text-joy-gray-900">Bank Transfer / Wire</h2>
                    <p className="text-sm text-joy-gray-500 mt-1">Configure bank transfer payment details</p>
                  </div>
                  <label className="flex items-center gap-2">
                    <span className="text-sm text-joy-gray-600">{paymentSettings.bankTransfer?.enabled ? 'Enabled' : 'Disabled'}</span>
                    <button onClick={() => setPaymentSettings({ ...paymentSettings, bankTransfer: { ...paymentSettings.bankTransfer, enabled: !paymentSettings.bankTransfer?.enabled } })} className={`w-12 h-6 rounded-full transition-colors ${paymentSettings.bankTransfer?.enabled ? 'bg-joy-orange' : 'bg-joy-gray-300'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${paymentSettings.bankTransfer?.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Bank Name</label>
                      <input type="text" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="Bank of America" value={paymentSettings.bankTransfer?.bankName || ''} onChange={e => setPaymentSettings({ ...paymentSettings, bankTransfer: { ...paymentSettings.bankTransfer, bankName: e.target.value } })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Account Name</label>
                      <input type="text" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="Your Company Name" value={paymentSettings.bankTransfer?.accountName || ''} onChange={e => setPaymentSettings({ ...paymentSettings, bankTransfer: { ...paymentSettings.bankTransfer, accountName: e.target.value } })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Account Number</label>
                      <input type="text" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="123456789" value={paymentSettings.bankTransfer?.accountNumber || ''} onChange={e => setPaymentSettings({ ...paymentSettings, bankTransfer: { ...paymentSettings.bankTransfer, accountNumber: e.target.value } })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">SWIFT / BIC Code</label>
                      <input type="text" className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="BOFAUS3N" value={paymentSettings.bankTransfer?.swiftCode || ''} onChange={e => setPaymentSettings({ ...paymentSettings, bankTransfer: { ...paymentSettings.bankTransfer, swiftCode: e.target.value } })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1">Payment Instructions</label>
                    <textarea className="w-full px-4 py-2 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange min-h-[80px]" placeholder="Instructions shown to customers after order placement" value={paymentSettings.bankTransfer?.instructions || ''} onChange={e => setPaymentSettings({ ...paymentSettings, bankTransfer: { ...paymentSettings.bankTransfer, instructions: e.target.value } })} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={savePaymentSettings} isLoading={isSaving}>Save Payment Settings</Button>
              </div>
            </div>
          )}

          {/* Header & Footer Tab */}
          {activeTab === 'header_footer' && headerSettings && footerSettings && (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-2 flex items-center gap-2"><Icons.Menu size={20} className="text-joy-orange" />Header Settings</h2>
                <p className="text-sm text-joy-gray-500 mb-6">Edit the top navigation bar content</p>
                
                <div className="space-y-6">
                  {/* Promo Banner */}
                  <div className="border border-joy-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-joy-gray-900">Promo Banner</h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={headerSettings.promoBanner?.enabled} onChange={e => setHeaderSettings({...headerSettings, promoBanner: {...headerSettings.promoBanner, enabled: e.target.checked}})} className="rounded" />
                        <span className="text-sm text-joy-gray-600">Show Banner</span>
                      </label>
                    </div>
                    {headerSettings.promoBanner?.enabled && (
                      <textarea
                        className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange min-h-[80px]"
                        placeholder="Promo banner text (HTML supported)"
                        value={headerSettings.promoBanner?.text || ''}
                        onChange={e => setHeaderSettings({...headerSettings, promoBanner: {...headerSettings.promoBanner, text: e.target.value}})}
                      />
                    )}
                  </div>

                  {/* Logo */}
                  <div className="border border-joy-gray-200 rounded-xl p-5">
                    <h3 className="font-medium text-joy-gray-900 mb-4">Logo</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-joy-gray-700 mb-2">Logo Type</label>
                        <select className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" value={headerSettings.logo?.type || 'text'} onChange={e => setHeaderSettings({...headerSettings, logo: {...headerSettings.logo, type: e.target.value}})}>
                          <option value="text">Text Logo</option>
                          <option value="image">Image Logo</option>
                        </select>
                      </div>
                      {headerSettings.logo?.type === 'text' ? (
                        <div>
                          <label className="block text-sm font-medium text-joy-gray-700 mb-2">Logo Text</label>
                          <input type="text" className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" value={headerSettings.logo?.text || ''} onChange={e => setHeaderSettings({...headerSettings, logo: {...headerSettings.logo, text: e.target.value}})} />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-joy-gray-700 mb-2">Image URL</label>
                          <input type="text" className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="https://..." value={headerSettings.logo?.image || ''} onChange={e => setHeaderSettings({...headerSettings, logo: {...headerSettings.logo, image: e.target.value}})} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="border border-joy-gray-200 rounded-xl p-5">
                    <h3 className="font-medium text-joy-gray-900 mb-4">Navigation Links</h3>
                    <div className="space-y-3">
                      {(headerSettings.navLinks || []).map((link: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3">
                          <input type="text" placeholder="Label" className="flex-1 px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={link.label} onChange={e => { const links = [...headerSettings.navLinks]; links[idx] = {...links[idx], label: e.target.value}; setHeaderSettings({...headerSettings, navLinks: links}); }} />
                          <input type="text" placeholder="/products" className="flex-1 px-3 py-2 rounded-lg border border-joy-gray-200 text-sm" value={link.href} onChange={e => { const links = [...headerSettings.navLinks]; links[idx] = {...links[idx], href: e.target.value}; setHeaderSettings({...headerSettings, navLinks: links}); }} />
                          <button onClick={() => { const links = headerSettings.navLinks.filter((_: any, i: number) => i !== idx); setHeaderSettings({...headerSettings, navLinks: links}); }} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Icons.Trash2 size={16} /></button>
                        </div>
                      ))}
                      <button onClick={() => setHeaderSettings({...headerSettings, navLinks: [...(headerSettings.navLinks || []), { label: 'New Link', href: '/' }]})} className="w-full py-2 border-2 border-dashed border-joy-gray-300 rounded-lg text-sm text-joy-gray-500 hover:border-joy-orange hover:text-joy-orange">
                        + Add Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Section */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-2 flex items-center gap-2"><Icons.Sparkles size={20} className="text-joy-orange" />Footer Settings</h2>
                <p className="text-sm text-joy-gray-500 mb-6">Edit the bottom footer content</p>
                
                <div className="space-y-6">
                  {/* Footer Columns */}
                  <div className="border border-joy-gray-200 rounded-xl p-5">
                    <h3 className="font-medium text-joy-gray-900 mb-4">Footer Columns</h3>
                    <div className="space-y-4">
                      {(footerSettings.columns || []).map((col: any, idx: number) => (
                        <div key={idx} className="border border-joy-gray-100 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <input type="text" className="flex-1 px-3 py-2 rounded-lg border border-joy-gray-200 text-sm font-medium" placeholder="Column Title" value={col.title} onChange={e => { const columns = [...footerSettings.columns]; columns[idx] = {...columns[idx], title: e.target.value}; setFooterSettings({...footerSettings, columns}); }} />
                            <button onClick={() => { const columns = footerSettings.columns.filter((_: any, i: number) => i !== idx); setFooterSettings({...footerSettings, columns}); }} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Icons.Trash2 size={16} /></button>
                          </div>
                          <div className="space-y-2 pl-4">
                            {(col.links || []).map((link: any, linkIdx: number) => (
                              <div key={linkIdx} className="flex items-center gap-2">
                                <input type="text" placeholder="Label" className="flex-1 px-2 py-1 rounded border border-joy-gray-200 text-sm" value={link.label} onChange={e => { const columns = [...footerSettings.columns]; const links = [...columns[idx].links]; links[linkIdx] = {...links[linkIdx], label: e.target.value}; columns[idx] = {...columns[idx], links}; setFooterSettings({...footerSettings, columns}); }} />
                                <input type="text" placeholder="/page" className="flex-1 px-2 py-1 rounded border border-joy-gray-200 text-sm" value={link.href} onChange={e => { const columns = [...footerSettings.columns]; const links = [...columns[idx].links]; links[linkIdx] = {...links[linkIdx], href: e.target.value}; columns[idx] = {...columns[idx], links}; setFooterSettings({...footerSettings, columns}); }} />
                                <button onClick={() => { const columns = [...footerSettings.columns]; const links = columns[idx].links.filter((_: any, i: number) => i !== linkIdx); columns[idx] = {...columns[idx], links}; setFooterSettings({...footerSettings, columns}); }} className="p-1 hover:bg-red-50 rounded text-red-400"><Icons.X size={14} /></button>
                              </div>
                            ))}
                            <button onClick={() => { const columns = [...footerSettings.columns]; const links = [...(columns[idx].links || []), { label: 'Link', href: '/' }]; columns[idx] = {...columns[idx], links}; setFooterSettings({...footerSettings, columns}); }} className="text-sm text-joy-orange hover:underline">+ Add Link</button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => setFooterSettings({...footerSettings, columns: [...(footerSettings.columns || []), { title: 'New Column', links: [] }]})} className="w-full py-2 border-2 border-dashed border-joy-gray-300 rounded-lg text-sm text-joy-gray-500 hover:border-joy-orange hover:text-joy-orange">
                        + Add Column
                      </button>
                    </div>
                  </div>

                  {/* Contact & Copyright */}
                  <div className="border border-joy-gray-200 rounded-xl p-5">
                    <h3 className="font-medium text-joy-gray-900 mb-4">Contact & Copyright</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-joy-gray-700 mb-2">Contact Email</label>
                        <input type="email" className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="contact@example.com" value={footerSettings.contact?.email || ''} onChange={e => setFooterSettings({...footerSettings, contact: {...footerSettings.contact, email: e.target.value}})} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-joy-gray-700 mb-2">Contact Phone</label>
                        <input type="text" className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange" placeholder="+1 234 567 8900" value={footerSettings.contact?.phone || ''} onChange={e => setFooterSettings({...footerSettings, contact: {...footerSettings.contact, phone: e.target.value}})} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-joy-gray-700 mb-2">Copyright Text (HTML supported)</label>
                      <textarea className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange min-h-[60px]" placeholder="© 2024 Your Store. All rights reserved." value={footerSettings.copyright || ''} onChange={e => setFooterSettings({...footerSettings, copyright: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveHeaderFooter} isLoading={isSaving}>Save Header & Footer</Button>
              </div>
            </div>
          )}

          {/* SEO Tab */}
          {activeTab === 'seo' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-lg text-joy-gray-900 mb-2 flex items-center gap-2"><Icons.Search size={20} className="text-joy-orange" />SEO Settings</h2>
                <p className="text-sm text-joy-gray-500 mb-6">Manage homepage and default page meta tags for search engines</p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Meta Title</label>
                    <input type="text" className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange text-sm" value={seoSettings.title} onChange={e => setSeoSettings({...seoSettings, title: e.target.value})} placeholder="Page title for search engines" />
                    <p className="text-xs text-joy-gray-400 mt-1">{seoSettings.title.length}/60 characters (recommended)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Meta Description</label>
                    <textarea className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange text-sm min-h-[100px]" value={seoSettings.description} onChange={e => setSeoSettings({...seoSettings, description: e.target.value})} placeholder="Description shown in search results (155 characters recommended)" />
                    <p className="text-xs text-joy-gray-400 mt-1">{seoSettings.description.length}/155 characters (recommended)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">Keywords</label>
                    <input type="text" className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange text-sm" value={seoSettings.keywords} onChange={e => setSeoSettings({...seoSettings, keywords: e.target.value})} placeholder="Comma-separated keywords" />
                    <p className="text-xs text-joy-gray-400 mt-1">Separate keywords with commas</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">OG Image URL (Open Graph)</label>
                    <input type="text" className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange text-sm" value={seoSettings.ogImage} onChange={e => setSeoSettings({...seoSettings, ogImage: e.target.value})} placeholder="https://example.com/og-image.jpg" />
                    <p className="text-xs text-joy-gray-400 mt-1">Recommended size: 1200x630px</p>
                    {seoSettings.ogImage && <img src={seoSettings.ogImage} alt="OG Preview" className="mt-3 w-64 h-32 object-cover rounded-xl border border-joy-gray-200" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSeoSettings} isLoading={isSaving}>Save SEO Settings</Button>
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

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTemplateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b border-joy-gray-100 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-joy-gray-900">{editingTemplate ? 'Edit Template' : 'Add Template'}</h2>
              <button onClick={() => setShowTemplateModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Template Name *" placeholder="e.g., ChinaPost" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} />
                <Input label="Code *" placeholder="CHINAPOST" value={templateForm.code} onChange={e => setTemplateForm({...templateForm, code: e.target.value})} />
              </div>
              <Input label="Description" placeholder="Optional description" value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tmplActive" checked={templateForm.isActive} onChange={e => setTemplateForm({...templateForm, isActive: e.target.checked})} className="rounded" />
                <label htmlFor="tmplActive" className="text-sm text-joy-gray-700">Active</label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-joy-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
              <Button onClick={handleTemplateSubmit} isLoading={isSaving}>{editingTemplate ? 'Update' : 'Add Template'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Modal */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b border-joy-gray-100 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-joy-gray-900">{editingRate ? 'Edit Country Rate' : 'Add Country Rate'}</h2>
              <button onClick={() => setShowRateModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Zone-based country selection */}
              {!editingRate && (
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-2">Select Countries (by Zone)</label>
                  <div className="border border-joy-gray-200 rounded-xl p-4 max-h-60 overflow-y-auto">
                    {SHIPPING_ZONES.map(zone => (
                      <div key={zone.id} className="mb-3 last:mb-0">
                        <button
                          type="button"
                          onClick={() => {
                            const zoneCodes = zone.countries.map(c => c.code)
                            const allSelected = zoneCodes.every((c: string) => selectedCountries.includes(c))
                            if (allSelected) {
                              setSelectedCountries(selectedCountries.filter((c: string) => !zoneCodes.includes(c)))
                            } else {
                              setSelectedCountries([...new Set([...selectedCountries, ...zoneCodes])])
                            }
                          }}
                          className="flex items-center gap-2 w-full text-left font-medium text-joy-gray-800 hover:text-joy-orange mb-1"
                        >
                          <input
                            type="checkbox"
                            checked={zone.countries.every((c: any) => selectedCountries.includes(c.code))}
                            onChange={() => {}}
                            className="rounded"
                          />
                          {zone.name}
                        </button>
                        <div className="ml-6 flex flex-wrap gap-1">
                          {zone.countries.map(c => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                if (selectedCountries.includes(c.code)) {
                                  setSelectedCountries(selectedCountries.filter((x: string) => x !== c.code))
                                } else {
                                  setSelectedCountries([...selectedCountries, c.code])
                                }
                              }}
                              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                                selectedCountries.includes(c.code)
                                  ? 'bg-joy-orange text-white border-joy-orange'
                                  : 'bg-white text-joy-gray-600 border-joy-gray-200 hover:border-joy-orange'
                              }`}
                            >
                              {c.name} ({c.code})
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-joy-gray-500 mt-2">
                    {selectedCountries.length} country(ies) selected
                  </p>
                </div>
              )}

              {/* Edit mode: show single country */}
              {editingRate && (
                <div className="p-3 bg-joy-gray-50 rounded-lg">
                  <p className="font-medium text-joy-gray-900">{rateForm.countryName} ({rateForm.countryCode})</p>
                </div>
              )}

              {/* Shipping fee fields */}
              <div className="grid grid-cols-2 gap-4">
                <Input label="Base Cost (USD)" type="number" placeholder="5.99" value={rateForm.baseCost} onChange={e => setRateForm({...rateForm, baseCost: e.target.value})} />
                <Input label="Cost per KG (USD)" type="number" placeholder="2.50" value={rateForm.costPerKg} onChange={e => setRateForm({...rateForm, costPerKg: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Free Shipping Threshold" type="number" placeholder="199" value={rateForm.freeThreshold} onChange={e => setRateForm({...rateForm, freeThreshold: e.target.value})} />
                <Input label="Estimated Days" placeholder="7-15 days" value={rateForm.estimatedDays} onChange={e => setRateForm({...rateForm, estimatedDays: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Min Weight (kg)" type="number" placeholder="0" value={rateForm.minWeight} onChange={e => setRateForm({...rateForm, minWeight: e.target.value})} />
                <Input label="Max Weight (kg, 0=unlimited)" type="number" placeholder="0" value={rateForm.maxWeight} onChange={e => setRateForm({...rateForm, maxWeight: e.target.value})} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="rateActive" checked={rateForm.isActive} onChange={e => setRateForm({...rateForm, isActive: e.target.checked})} className="rounded" />
                <label htmlFor="rateActive" className="text-sm text-joy-gray-700">Active</label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-joy-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowRateModal(false)}>Cancel</Button>
              <Button onClick={handleRateSubmit} isLoading={isSaving}>{editingRate ? 'Update' : `Add ${editingRate ? '' : selectedCountries.length + ' ' + (selectedCountries.length === 1 ? 'Country' : 'Countries')}`}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

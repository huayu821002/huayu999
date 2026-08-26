'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { adminFetch } from '@/lib/adminFetch'

const PAGE_TYPES = [
  { value: 'homepage', label: 'Homepage', slugPlaceholder: 'homepage' },
  { value: 'category', label: 'Category', slugPlaceholder: 'e.g. party-supplies' },
  { value: 'product', label: 'Product', slugPlaceholder: 'e.g. product-slug' },
  { value: 'custom', label: 'Custom Page', slugPlaceholder: 'e.g. about-us' },
]

const LOCALES = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'pt', label: '🇧🇷 Portuguese (BR)' },
  { value: 'ru', label: '🇷🇺 Russian' },
]

interface SeoSetting {
  id: string
  pageType: string
  pageSlug: string
  locale: string
  title: string
  description: string
  keywords: string
  ogTitle: string
  ogDescription: string
  canonicalUrl: string
}

interface Category {
  id: string
  name: string
  slug: string
  children?: { id: string; name: string; slug: string }[]
}

export default function SeoSettingsPage() {
  const [settings, setSettings] = useState<SeoSetting[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pageType, setPageType] = useState('category')
  const [pageSlug, setPageSlug] = useState('')
  const [locale, setLocale] = useState('en')
  const [form, setForm] = useState({ title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', canonicalUrl: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'edit' | 'list'>('edit')
  const [searchQuery, setSearchQuery] = useState('')

  // Load categories for dropdown
  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch('/api/site/categories-full')
        const data = await res.json()
        if (data.success) setCategories(data.data)
      } catch {}
    }
    load()
  }, [])

  // Load all existing settings
  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const res = await adminFetch('/api/admin/seo')
      const data = await res.json()
      if (data.success) setSettings(data.data)
    } catch {} finally { setIsLoading(false) }
  }

  useEffect(() => { loadSettings() }, [])

  // Load current setting when type/slug/locale changes
  useEffect(() => {
    const load = async () => {
      if (!pageType) return
      try {
        const res = await adminFetch(`/api/admin/seo?pageType=${pageType}&pageSlug=${pageSlug}&locale=${locale}`)
        const data = await res.json()
        if (data.data) {
          setForm({
            title: data.data.title || '',
            description: data.data.description || '',
            keywords: data.data.keywords || '',
            ogTitle: data.data.ogTitle || '',
            ogDescription: data.data.ogDescription || '',
            canonicalUrl: data.data.canonicalUrl || '',
          })
        } else {
          setForm({ title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', canonicalUrl: '' })
        }
      } catch {}
    }
    load()
  }, [pageType, pageSlug, locale])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMsg('')
    try {
      const res = await adminFetch('/api/admin/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageType, pageSlug, locale, ...form }),
      })
      const data = await res.json()
      if (data.success) {
        setSaveMsg('✅ SEO settings saved!')
        loadSettings()
        setTimeout(() => setSaveMsg(''), 3000)
      } else {
        setSaveMsg('❌ Error: ' + data.error)
      }
    } catch { setSaveMsg('❌ Network error') } finally { setIsSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this SEO setting?')) return
    await adminFetch(`/api/admin/seo?id=${id}`, { method: 'DELETE' })
    loadSettings()
  }

  const filteredSettings = settings.filter(s => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return s.title.toLowerCase().includes(q) || s.pageSlug.toLowerCase().includes(q) || s.pageType.toLowerCase().includes(q)
  })

  const charCount = form.description.length
  const titleCount = form.title.length

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-joy-gray-900">SEO Settings</h1>
          <p className="text-joy-gray-500 mt-1">Manage meta tags, titles, descriptions & Open Graph for all pages</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-joy-gray-100 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveTab('edit')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'edit' ? 'bg-white shadow text-joy-gray-900' : 'text-joy-gray-600 hover:text-gray-900'}`}>Edit / Add</button>
          <button onClick={() => setActiveTab('list')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-white shadow text-joy-gray-900' : 'text-joy-gray-600 hover:text-gray-900'}`}>All Settings ({settings.length})</button>
        </div>

        {activeTab === 'edit' ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Page Type & Locale Selection */}
            <div className="p-6 border-b border-joy-gray-100">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">Page Type</label>
                  <select value={pageType} onChange={e => { setPageType(e.target.value); setPageSlug('') }} className="w-full px-3 py-2 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50">
                    {PAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">Language / Region</label>
                  <select value={locale} onChange={e => setLocale(e.target.value)} className="w-full px-3 py-2 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50">
                    {LOCALES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
                    {pageType === 'category' ? 'Category' : pageType === 'product' ? 'Product Slug' : 'Page Slug'}
                  </label>
                  {pageType === 'category' ? (
                    <select value={pageSlug} onChange={e => setPageSlug(e.target.value)} className="w-full px-3 py-2 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50">
                      <option value="">Select category...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.slug}>{cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={pageSlug} onChange={e => setPageSlug(e.target.value)} placeholder={PAGE_TYPES.find(t => t.value === pageType)?.slugPlaceholder} className="w-full px-3 py-2 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50" />
                  )}
                </div>
              </div>
            </div>

            {/* SEO Fields */}
            <div className="p-6 space-y-5">
              {/* Google Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-joy-gray-700">Page Title</label>
                  <span className={`text-xs ${titleCount > 60 ? 'text-red-500' : titleCount > 50 ? 'text-orange-500' : 'text-joy-gray-400'}`}>{titleCount}/60</span>
                </div>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Wholesale Party Supplies Bulk | Party Decorations Supplier - Fiestaflare" className="w-full px-4 py-2.5 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50" />
                <p className="text-xs text-joy-gray-400 mt-1">Ideal: 50-60 characters. Shown as the blue link in Google.</p>
              </div>

              {/* Google Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-joy-gray-700">Meta Description</label>
                  <span className={`text-xs ${charCount > 160 ? 'text-red-500' : charCount > 140 ? 'text-orange-500' : 'text-joy-gray-400'}`}>{charCount}/160</span>
                </div>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Shop bulk party supplies from China factory prices. LED balloons, banners, table decorations & more. $50 min mixed order. Dropshipping available for USA, Brazil & LATAM." className="w-full px-4 py-2.5 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50 resize-none" />
                <p className="text-xs text-joy-gray-400 mt-1">Ideal: 140-160 characters. Shown as the snippet below the link in Google.</p>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-joy-gray-700">Keywords</label>
                <input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="wholesale party supplies, party decorations bulk, balloon supplier, event dropshipping" className="w-full px-4 py-2.5 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50" />
                <p className="text-xs text-joy-gray-400 mt-1">Comma-separated. Low weight for Google but useful for internal tracking.</p>
              </div>

              <div className="border-t border-joy-gray-100 pt-5">
                <p className="text-sm font-semibold text-joy-gray-700 mb-3">🔗 Open Graph (Social Sharing)</p>

                {/* OG Title */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">OG Title</label>
                  <input value={form.ogTitle} onChange={e => setForm(f => ({ ...f, ogTitle: e.target.value }))} placeholder="Wholesale Party Supplies - Fiestaflare" className="w-full px-4 py-2.5 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50" />
                  <p className="text-xs text-joy-gray-400 mt-1">Shown when shared on Facebook, WhatsApp, Twitter. Leave blank to use Page Title.</p>
                </div>

                {/* OG Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">OG Description</label>
                  <textarea value={form.ogDescription} onChange={e => setForm(f => ({ ...f, ogDescription: e.target.value }))} rows={2} placeholder="Bulk party supplies from China factory prices. LED balloons, banners & more." className="w-full px-4 py-2.5 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50 resize-none" />
                  <p className="text-xs text-joy-gray-400 mt-1">Shown when shared on social media. Aim for 40-80 characters.</p>
                </div>

                {/* Canonical URL */}
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">Canonical URL</label>
                  <input value={form.canonicalUrl} onChange={e => setForm(f => ({ ...f, canonicalUrl: e.target.value }))} placeholder="https://fiestaflare.com/categories/party-supplies" className="w-full px-4 py-2.5 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50" />
                  <p className="text-xs text-joy-gray-400 mt-1">Leave blank unless you need to point to a different canonical URL.</p>
                </div>
              </div>

              {/* Google Preview */}
              <div className="border-t border-joy-gray-100 pt-5">
                <p className="text-sm font-semibold text-joy-gray-700 mb-3">🔍 Google Search Preview</p>
                <div className="border border-joy-gray-200 rounded-xl p-4 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-2">fiestaflare.com/categories/{pageSlug || '...'}</p>
                  <p className="text-lg text-blue-600 hover:underline cursor-pointer mb-1">{form.title || '<Page Title>'}</p>
                  <p className="text-sm text-green-700 mb-1">⭐⭐⭐⭐⭐ <span className="text-gray-600 text-xs">Fiestaflare</span></p>
                  <p className="text-sm text-gray-600 leading-snug">{form.description || '<Meta description will appear here. Add a compelling description for better click-through rates.>'}</p>
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="px-6 py-4 bg-joy-gray-50 border-t border-joy-gray-100 flex items-center justify-between">
              {saveMsg && <span className="text-sm">{saveMsg}</span>}
              <div className="flex items-center gap-3 ml-auto">
                <Button variant="secondary" onClick={() => setForm({ title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', canonicalUrl: '' })}>Clear</Button>
                <Button onClick={handleSave} isLoading={isSaving}>Save SEO Settings</Button>
              </div>
            </div>
          </div>
        ) : (
          /* Settings List */
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-joy-gray-100">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search settings..." className="w-full max-w-xs px-4 py-2 border border-joy-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50" />
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-joy-gray-400">Loading...</div>
            ) : filteredSettings.length === 0 ? (
              <div className="p-8 text-center text-joy-gray-400">No SEO settings yet. Go to "Edit / Add" to create one.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-joy-gray-50">
                    <tr>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-3">Page</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-3">Title</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-3">Locale</th>
                      <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-joy-gray-100">
                    {filteredSettings.map(setting => (
                      <tr key={setting.id} className="hover:bg-joy-gray-50">
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium px-2 py-1 rounded-lg bg-joy-gray-100 text-joy-gray-600 mr-2">{setting.pageType}</span>
                          <span className="text-sm text-joy-gray-800 font-mono">{setting.pageSlug}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-joy-gray-800 max-w-xs truncate">{setting.title || <span className="text-joy-gray-300 italic">No title</span>}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium">{LOCALES.find(l => l.value === setting.locale)?.label || setting.locale}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setPageType(setting.pageType); setPageSlug(setting.pageSlug); setLocale(setting.locale); setActiveTab('edit') }} className="p-1.5 hover:bg-joy-gray-100 rounded-lg transition-colors" title="Edit"><Icons.Edit3 size={14} /></button>
                            <button onClick={() => handleDelete(setting.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors" title="Delete"><Icons.Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

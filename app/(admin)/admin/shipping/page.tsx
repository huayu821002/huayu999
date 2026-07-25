'use client'

import { useState, useEffect } from 'react'

interface ShippingTemplate {
  id: string
  name: string
  baseCost: number
  costPerKg: number
  freeThreshold: number
  estimatedDays: string | null
  isActive: boolean
  sortOrder: number
}

interface ShippingRate {
  countryCode: string
  countryName: string
  baseCost: number
  costPerKg: number
  freeThreshold: number
  estimatedDays: string | null
  isActive: boolean
  templateId?: string
}

const allCountries = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'PL', name: 'Poland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'SE', name: 'Sweden' },
  { code: 'AT', name: 'Austria' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'RO', name: 'Romania' },
  { code: 'HU', name: 'Hungary' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IN', name: 'India' },
  { code: 'HK', name: '中国香港' },
  { code: 'MO', name: '中国澳门' },
  { code: 'TW', name: '中国台湾' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'CL', name: 'Chile' },
]

export default function ShippingSettingsPage() {
  const [templates, setTemplates] = useState<ShippingTemplate[]>([])
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'templates' | 'countries'>('templates')
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'template' | 'rate'>('template')
  const [editingItem, setEditingItem] = useState<any>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch rates
      const ratesRes = await fetch('/api/admin/shipping')
      const ratesData = await ratesRes.json()
      setRates(Array.isArray(ratesData) ? ratesData : [])

      // Fetch templates from settings API
      const settingsRes = await fetch('/api/admin/settings')
      const settingsData = await settingsRes.json()
      
      let loadedTemplates: ShippingTemplate[] = []
      if (settingsData && settingsData.data) {
        const templatesSetting = settingsData.data.find((s: any) => s.key === 'shipping_templates')
        if (templatesSetting && templatesSetting.value) {
          try {
            loadedTemplates = JSON.parse(templatesSetting.value)
          } catch (e) {
            console.error('Failed to parse templates:', e)
          }
        }
      }
      setTemplates(loadedTemplates)
    } catch (error) {
      console.error('Failed to fetch:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSaveTemplate = async () => {
    if (!editingItem.name) {
      alert('Please enter template name')
      return
    }
    
    setSaving(true)
    try {
      let newTemplates: ShippingTemplate[]
      if (editingItem.id) {
        newTemplates = templates.map(t => t.id === editingItem.id ? { ...t, ...editingItem } : t)
      } else {
        const newTemplate: ShippingTemplate = {
          id: Date.now().toString(),
          name: editingItem.name,
          baseCost: editingItem.baseCost || 0,
          costPerKg: editingItem.costPerKg || 0,
          freeThreshold: editingItem.freeThreshold || 0,
          estimatedDays: editingItem.estimatedDays || null,
          isActive: editingItem.isActive !== false,
          sortOrder: editingItem.sortOrder || 0
        }
        newTemplates = [...templates, newTemplate]
      }
      
      // Save to settings API
      console.log('Saving templates:', newTemplates)
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'shipping_templates',
          value: JSON.stringify(newTemplates)
        })
      })
      console.log('Response status:', res.status)
      const resData = await res.json()
      console.log('Response data:', resData)
      
      if (res.ok && resData.success) {
        setTemplates(newTemplates)
        setShowModal(false)
        setEditingItem(null)
      } else {
        alert('Failed to save template: ' + (resData.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    
    const newTemplates = templates.filter(t => t.id !== id)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'shipping_templates',
          value: JSON.stringify(newTemplates)
        })
      })
      const data = await res.json()
      console.log('Delete template response:', data)
      if (res.ok) {
        setTemplates(newTemplates)
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleSaveRate = async () => {
    if (!editingItem.countryCode) {
      alert('Please select a country')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/admin/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode: editingItem.countryCode,
          countryName: editingItem.countryName,
          baseCost: editingItem.baseCost || 0,
          costPerKg: editingItem.costPerKg || 0,
          freeThreshold: editingItem.freeThreshold || 0,
          estimatedDays: editingItem.estimatedDays || null,
          isActive: editingItem.isActive !== false
        })
      })
      
      if (res.ok) {
        await fetchData() // Refresh data
        setShowModal(false)
        setEditingItem(null)
      } else {
        alert('Failed to save country rate')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save country rate')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRate = async (countryCode: string) => {
    if (!confirm('Delete this country rate?')) return
    try {
      const res = await fetch(`/api/admin/shipping?countryCode=${countryCode}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const openTemplateModal = (template?: ShippingTemplate) => {
    setModalType('template')
    setEditingItem(template || { 
      name: '', 
      baseCost: 0, 
      costPerKg: 0, 
      freeThreshold: 0, 
      estimatedDays: '', 
      isActive: true, 
      sortOrder: 0 
    })
    setShowModal(true)
  }

  const openRateModal = (country?: { code: string; name: string }, existingRate?: ShippingRate) => {
    setModalType('rate')
    if (existingRate) {
      setEditingItem(existingRate)
    } else if (country) {
      setEditingItem({
        countryCode: country.code,
        countryName: country.name,
        baseCost: 0,
        costPerKg: 0,
        freeThreshold: 0,
        estimatedDays: '',
        isActive: true,
        templateId: ''
      })
    }
    setShowModal(true)
  }

  const applyTemplate = (template: ShippingTemplate) => {
    if (editingItem) {
      setEditingItem({
        ...editingItem,
        baseCost: template.baseCost,
        costPerKg: template.costPerKg,
        freeThreshold: template.freeThreshold,
        estimatedDays: template.estimatedDays,
        templateId: template.id
      })
    }
  }

  const availableCountries = allCountries.filter(c => !rates.find(r => r.countryCode === c.code))

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-joy-gray-900">Shipping Settings</h1>
        <p className="text-joy-gray-500 mt-1">Manage shipping templates and country rates</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'templates' ? 'bg-joy-orange text-white' : 'bg-white text-joy-gray-600 hover:bg-joy-gray-50'}`}
        >
          Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('countries')}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'countries' ? 'bg-joy-orange text-white' : 'bg-white text-joy-gray-600 hover:bg-joy-gray-50'}`}
        >
          Countries ({rates.length})
        </button>
      </div>

      {activeTab === 'templates' ? (
        <>
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-joy-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-joy-gray-900">Shipping Templates</h3>
                <p className="text-sm text-joy-gray-500">Create reusable templates like "Europe Standard"</p>
              </div>
              <button
                onClick={() => openTemplateModal()}
                className="px-4 py-2 bg-joy-orange text-white rounded-lg hover:bg-orange-600 transition"
              >
                Add Template
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-joy-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-joy-gray-500">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="p-8 text-center text-joy-gray-500">
                No templates yet. Create one to get started!
              </div>
            ) : (
              <div className="divide-y divide-joy-gray-100">
                {templates.map(template => (
                  <div key={template.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${template.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div>
                        <p className="font-medium text-joy-gray-900">{template.name}</p>
                        <p className="text-sm text-joy-gray-500">
                          Base: ${template.baseCost.toFixed(2)} | Per kg: ${template.costPerKg.toFixed(2)} | Free over: ${template.freeThreshold.toFixed(2)}
                          {template.estimatedDays && ` | {template.estimatedDays}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openTemplateModal(template)} className="px-3 py-1.5 text-sm text-joy-orange hover:bg-orange-50 rounded-lg">Edit</button>
                      <button onClick={() => handleDeleteTemplate(template.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-joy-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-joy-gray-900">Country Rates</h3>
                <p className="text-sm text-joy-gray-500">Configure shipping for each country</p>
              </div>
              <select
                className="border border-joy-gray-200 rounded-lg px-3 py-2 text-sm"
                onChange={(e) => {
                  const country = allCountries.find(c => c.code === e.target.value)
                  if (country) openRateModal(country)
                }}
                defaultValue=""
              >
                <option value="" disabled>Select country...</option>
                {availableCountries.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-joy-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-joy-gray-500">Loading...</div>
            ) : rates.length === 0 ? (
              <div className="p-8 text-center text-joy-gray-500">No country rates configured yet.</div>
            ) : (
              <div className="divide-y divide-joy-gray-100">
                {rates.map(rate => (
                  <div key={rate.countryCode} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${rate.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div>
                        <p className="font-medium text-joy-gray-900">{rate.countryName}</p>
                        <p className="text-sm text-joy-gray-500">
                          Base: ${rate.baseCost.toFixed(2)} | Per kg: ${rate.costPerKg.toFixed(2)} | Free over: ${rate.freeThreshold.toFixed(2)}
                          {rate.estimatedDays && ` | {rate.estimatedDays}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openRateModal(undefined, rate)} className="px-3 py-1.5 text-sm text-joy-orange hover:bg-orange-50 rounded-lg">Edit</button>
                      <button onClick={() => handleDeleteRate(rate.countryCode)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-joy-gray-900 mb-4">
              {modalType === 'template' 
                ? (templates.find(t => t.id === editingItem.id) ? 'Edit Template' : 'New Template')
                : (rates.find(r => r.countryCode === editingItem.countryCode) ? 'Edit Country' : 'Add Country')
              }
            </h2>

            <div className="space-y-4">
              {modalType === 'template' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1">Template Name *</label>
                    <input type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                      placeholder="e.g., Europe Standard" className="w-full border border-joy-gray-200 rounded-lg px-3 py-2" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1">Country</label>
                    <input type="text" value={editingItem.countryName} disabled className="w-full border border-joy-gray-200 rounded-lg px-3 py-2 bg-joy-gray-50" />
                  </div>
                  {templates.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">Apply Template</label>
                      <select
                        className="w-full border border-joy-gray-200 rounded-lg px-3 py-2"
                        onChange={e => {
                          const t = templates.find(t => t.id === e.target.value)
                          if (t) applyTemplate(t)
                        }}
                        defaultValue=""
                      >
                        <option value="">Select a template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">Base Cost (USD)</label>
                <input type="number" step="0.01" value={editingItem.baseCost}
                  onChange={e => setEditingItem({...editingItem, baseCost: parseFloat(e.target.value) || 0})}
                  className="w-full border border-joy-gray-200 rounded-lg px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">Cost per KG (USD)</label>
                <input type="number" step="0.01" value={editingItem.costPerKg}
                  onChange={e => setEditingItem({...editingItem, costPerKg: parseFloat(e.target.value) || 0})}
                  className="w-full border border-joy-gray-200 rounded-lg px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">Free Shipping Threshold (USD)</label>
                <input type="number" step="0.01" value={editingItem.freeThreshold}
                  onChange={e => setEditingItem({...editingItem, freeThreshold: parseFloat(e.target.value) || 0})}
                  className="w-full border border-joy-gray-200 rounded-lg px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">Estimated Delivery</label>
                <input type="text" value={editingItem.estimatedDays || ''}
                  onChange={e => setEditingItem({...editingItem, estimatedDays: e.target.value || null})}
                  placeholder="e.g., 7-14 days" className="w-full border border-joy-gray-200 rounded-lg px-3 py-2" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={editingItem.isActive !== false}
                  onChange={e => setEditingItem({...editingItem, isActive: e.target.checked})}
                  className="w-4 h-4 text-joy-orange" />
                <label htmlFor="isActive" className="text-sm text-joy-gray-700">Active</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowModal(false); setEditingItem(null) }}
                className="px-4 py-2 text-sm text-joy-gray-600 hover:bg-joy-gray-50 rounded-lg">Cancel</button>
              <button 
                onClick={modalType === 'template' ? handleSaveTemplate : handleSaveRate}
                disabled={saving} 
                className="px-4 py-2 text-sm bg-joy-orange text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

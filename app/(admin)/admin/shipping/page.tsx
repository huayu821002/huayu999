'use client'

import { useState, useEffect } from 'react'
import { adminFetch } from '@/lib/adminFetch'

interface ShippingRate {
  id?: string
  countryCode: string
  countryName: string
  baseCost: number
  costPerKg: number
  freeThreshold: number
  minWeight: number
  maxWeight: number
  estimatedDays: string | null
  isActive: boolean
  methodId?: string | null
  warehouseId?: string | null
  warehouseName?: string
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
  { code: 'HK', name: 'Hong Kong' },
  { code: 'MO', name: 'Macau' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AE', name: 'UAE' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel' },
  { code: 'EG', name: 'Egypt' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
]

export default function ShippingSettingsPage() {
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null)

  const fetchRates = async () => {
    try {
      const res = await adminFetch('/api/admin/shipping-rates')
      if (res.ok) {
        const data = await res.json()
        setRates(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch rates:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const res = await adminFetch('/api/admin/warehouses')
      const data = await res.json()
      if (data.success) setWarehouses(data.data || [])
    } catch (error) {
      console.error('Failed to fetch warehouses:', error)
    }
  }

  useEffect(() => {
    fetchRates()
    fetchWarehouses()
  }, [])

  const handleSave = async (rate: ShippingRate) => {
    setSaving(true)
    try {
      const url = rate.id ? `/api/admin/shipping-rates/${rate.id}` : '/api/admin/shipping-rates'
      const method = rate.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rate),
      })
      if (res.ok) {
        await fetchRates()
        setShowModal(false)
        setEditingRate(null)
      }
    } catch (error) {
      console.error('Failed to save rate:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shipping rate?')) return
    try {
      const res = await fetch(`/api/admin/shipping-rates/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchRates()
      }
    } catch (error) {
      console.error('Failed to delete rate:', error)
    }
  }

  const handleToggleActive = async (rate: ShippingRate) => {
    if (!rate.id) return
    await handleSave({ ...rate, isActive: !rate.isActive })
  }

  const openModal = (rate?: ShippingRate, country?: { code: string; name: string }) => {
    if (rate) {
      setEditingRate(rate)
    } else if (country) {
      setEditingRate({
        countryCode: country.code,
        countryName: country.name,
        baseCost: 0,
        costPerKg: 0,
        freeThreshold: 0,
        minWeight: 0,
        maxWeight: 0,
        estimatedDays: null,
        isActive: true,
        warehouseId: null,
      })
    }
    setShowModal(true)
  }

  const availableCountries = allCountries.filter(
    (c) => !rates.find((r) => r.countryCode === c.code)
  )

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-joy-gray-900">Shipping Rates</h1>
        <p className="text-joy-gray-500 mt-1">Configure shipping rates by country (legacy view)</p>
      </div>

      {/* Add New Rate */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-joy-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-joy-gray-900">Add New Country</h3>
            <p className="text-sm text-joy-gray-500">Configure shipping for a new destination</p>
          </div>
          <select
            className="border border-joy-gray-200 rounded-lg px-3 py-2 text-sm"
            onChange={(e) => {
              const country = allCountries.find((c) => c.code === e.target.value)
              if (country) openModal(undefined, country)
            }}
            defaultValue=""
          >
            <option value="" disabled>Select country...</option>
            {availableCountries.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rates List */}
      <div className="bg-white rounded-xl shadow-sm border border-joy-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-joy-gray-100">
          <h3 className="font-medium text-joy-gray-900">Configured Countries ({rates.length})</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-joy-gray-500">Loading...</div>
        ) : rates.length === 0 ? (
          <div className="p-8 text-center text-joy-gray-500">
            No shipping rates configured. Add a country above to get started.
          </div>
        ) : (
          <div className="divide-y divide-joy-gray-100">
            {rates.map((rate) => (
              <div key={rate.id || rate.countryCode} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${rate.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="font-medium text-joy-gray-900">{rate.countryName} <span className="text-joy-gray-400 text-sm">({rate.countryCode})</span>
                      {rate.warehouseId && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">📦 {warehouses.find(w => w.id === rate.warehouseId)?.name || rate.warehouseId}</span>}
                      {!rate.warehouseId && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Global</span>}
                    </p>
                    <p className="text-sm text-joy-gray-500">
                      Base: ${Number(rate.baseCost).toFixed(2)} | Per kg: ${Number(rate.costPerKg).toFixed(2)} | Free over: ${Number(rate.freeThreshold).toFixed(2)}
                      {rate.estimatedDays && ` | Est: ${rate.estimatedDays}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(rate)}
                    className="px-3 py-1.5 text-sm text-joy-orange hover:bg-orange-50 rounded-lg transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(rate)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition ${
                      rate.isActive
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {rate.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => rate.id && handleDelete(rate.id)}
                    disabled={!rate.id}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showModal && editingRate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-joy-gray-900 mb-4">
              {editingRate.id ? `Edit: ${editingRate.countryName}` : `Add: ${editingRate.countryName}`}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">Base Cost (USD)</label>
                <input
                  type="number" step="0.01"
                  value={editingRate.baseCost}
                  onChange={(e) => setEditingRate({ ...editingRate, baseCost: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-joy-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">Cost per KG (USD)</label>
                <input
                  type="number" step="0.01"
                  value={editingRate.costPerKg}
                  onChange={(e) => setEditingRate({ ...editingRate, costPerKg: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-joy-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">Free Shipping Threshold (USD)</label>
                <input
                  type="number" step="0.01"
                  value={editingRate.freeThreshold}
                  onChange={(e) => setEditingRate({ ...editingRate, freeThreshold: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-joy-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1">Min Weight (kg)</label>
                  <input
                    type="number" step="0.1"
                    value={editingRate.minWeight}
                    onChange={(e) => setEditingRate({ ...editingRate, minWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-joy-gray-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1">Max Weight (kg, 0=unlimited)</label>
                  <input
                    type="number" step="0.1"
                    value={editingRate.maxWeight}
                    onChange={(e) => setEditingRate({ ...editingRate, maxWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-joy-gray-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">Estimated Delivery Days</label>
                <input
                  type="text"
                  value={editingRate.estimatedDays || ''}
                  onChange={(e) => setEditingRate({ ...editingRate, estimatedDays: e.target.value || null })}
                  placeholder="e.g., 7-14 days"
                  className="w-full border border-joy-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">Warehouse (Optional)</label>
                <select
                  value={editingRate.warehouseId || ''}
                  onChange={(e) => setEditingRate({ ...editingRate, warehouseId: e.target.value || null })}
                  className="w-full border border-joy-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="">Global (No specific warehouse)</option>
                  {warehouses.filter(w => w.isActive).map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.country})</option>
                  ))}
                </select>
                <p className="text-xs text-joy-gray-500 mt-1">Leave empty to apply to all warehouses</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingRate.isActive}
                  onChange={(e) => setEditingRate({ ...editingRate, isActive: e.target.checked })}
                  className="w-4 h-4 text-joy-orange"
                />
                <label htmlFor="isActive" className="text-sm text-joy-gray-700">Active</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setEditingRate(null) }}
                className="px-4 py-2 text-sm text-joy-gray-600 hover:bg-joy-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(editingRate)}
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

'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { adminFetch } from '@/lib/adminFetch'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'

interface Warehouse {
  id: string
  name: string
  code: string
  country: string
  isDefault: boolean
  isActive: boolean
  sortOrder: number
}

interface WarehouseRate {
  id: string
  warehouseId: string
  warehouseName?: string
  countryCode: string
  countryName: string
  shippingCost: number
  costPerKg: number
  estimatedDays: string
  isActive: boolean
}

const PRESET_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'RU', name: 'Russia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'IN', name: 'India' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
]

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [rates, setRates] = useState<WarehouseRate[]>([])
  const [loading, setLoading] = useState(true)
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [showRateModal, setShowRateModal] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [editingRate, setEditingRate] = useState<WarehouseRate | null>(null)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [formData, setFormData] = useState({ name: '', code: '', country: '', isDefault: false, isActive: true })
  const [rateData, setRateData] = useState({ warehouseId: '', countryCode: '', countryName: '', shippingCost: '', costPerKg: '', estimatedDays: '' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [wRes, rRes] = await Promise.all([
        adminFetch('/api/admin/warehouses'),
        adminFetch('/api/admin/warehouse-shipping'),
      ])
      const wData = await wRes.json()
      const rData = await rRes.json()
      setWarehouses(wData.data || [])
      setRates(rData.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveWarehouse = async () => {
    try {
      const method = editingWarehouse ? 'PUT' : 'POST'
      const body = editingWarehouse ? { ...formData, id: editingWarehouse.id } : formData
      await adminFetch('/api/admin/warehouses', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
      setShowWarehouseModal(false)
      setEditingWarehouse(null)
      setFormData({ name: '', code: '', country: '', isDefault: false, isActive: true })
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteWarehouse = async (id: string) => {
    if (!confirm('Delete this warehouse?')) return
    try {
      await adminFetch(`/api/admin/warehouses?id=${id}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveRate = async () => {
    try {
      const method = editingRate ? 'PUT' : 'POST'
      const body = editingRate ? { ...rateData, id: editingRate.id } : rateData
      await adminFetch('/api/admin/warehouse-shipping', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
      setShowRateModal(false)
      setEditingRate(null)
      setRateData({ warehouseId: '', countryCode: '', countryName: '', shippingCost: '', costPerKg: '', estimatedDays: '' })
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteRate = async (id: string) => {
    if (!confirm('Delete this shipping rate?')) return
    try {
      await adminFetch(`/api/admin/warehouse-shipping?id=${id}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const openEditWarehouse = (w: Warehouse) => {
    setEditingWarehouse(w)
    setFormData({ name: w.name, code: w.code, country: w.country, isDefault: w.isDefault, isActive: w.isActive })
    setShowWarehouseModal(true)
  }

  const openEditRate = (r: WarehouseRate) => {
    setEditingRate(r)
    setRateData({ warehouseId: r.warehouseId, countryCode: r.countryCode, countryName: r.countryName, shippingCost: String(r.shippingCost), costPerKg: String(r.costPerKg), estimatedDays: r.estimatedDays || '' })
    setShowRateModal(true)
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-joy-gray-900">Warehouse Management</h1>
            <p className="text-sm text-joy-gray-500">Manage overseas warehouses and shipping rates</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-joy-gray-400">Loading...</div>
        ) : (
          <>
            {/* Warehouses Section */}
            <div className="bg-white rounded-xl border border-joy-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg text-joy-gray-900">Warehouses</h2>
                <Button onClick={() => { setEditingWarehouse(null); setFormData({ name: '', code: '', country: '', isDefault: false, isActive: true }); setShowWarehouseModal(true) }} size="sm">
                  <Icons.Plus size={16} className="mr-1" /> Add Warehouse
                </Button>
              </div>
              {warehouses.length === 0 ? (
                <p className="text-joy-gray-400 text-center py-6">No warehouses yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-joy-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Code</th>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Country</th>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Default</th>
                        <th className="text-right px-4 py-3 font-medium text-joy-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {warehouses.map(w => (
                        <tr key={w.id} className="hover:bg-joy-gray-50">
                          <td className="px-4 py-3 font-medium text-joy-gray-900">{w.name}</td>
                          <td className="px-4 py-3 font-mono text-joy-gray-600">{w.code}</td>
                          <td className="px-4 py-3 text-joy-gray-600">{w.country}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${w.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {w.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {w.isDefault && <span className="text-joy-orange font-medium">✓ Default</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEditWarehouse(w)} className="text-joy-orange hover:text-orange-600 mr-3"><Icons.Edit2 size={16} /></button>
                            <button onClick={() => handleDeleteWarehouse(w.id)} className="text-red-500 hover:text-red-700"><Icons.Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Shipping Rates Section */}
            <div className="bg-white rounded-xl border border-joy-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg text-joy-gray-900">Warehouse Shipping Rates</h2>
                <Button onClick={() => { setEditingRate(null); setRateData({ warehouseId: warehouses[0]?.id || '', countryCode: '', countryName: '', shippingCost: '', costPerKg: '', estimatedDays: '' }); setShowRateModal(true) }} size="sm">
                  <Icons.Plus size={16} className="mr-1" /> Add Rate
                </Button>
              </div>
              {rates.length === 0 ? (
                <p className="text-joy-gray-400 text-center py-6">No shipping rates configured</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-joy-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Warehouse</th>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Country</th>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Shipping Cost</th>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Per Kg</th>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Est. Days</th>
                        <th className="text-left px-4 py-3 font-medium text-joy-gray-600">Status</th>
                        <th className="text-right px-4 py-3 font-medium text-joy-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rates.map(r => (
                        <tr key={r.id} className="hover:bg-joy-gray-50">
                          <td className="px-4 py-3 font-medium text-joy-gray-900">{(r as any).warehouse?.name || r.warehouseId}</td>
                          <td className="px-4 py-3 text-joy-gray-600">{r.countryName} ({r.countryCode})</td>
                          <td className="px-4 py-3 text-joy-orange font-semibold">${r.shippingCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-joy-gray-600">${r.costPerKg.toFixed(2)}</td>
                          <td className="px-4 py-3 text-joy-gray-600">{r.estimatedDays || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {r.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEditRate(r)} className="text-joy-orange hover:text-orange-600 mr-3"><Icons.Edit2 size={16} /></button>
                            <button onClick={() => handleDeleteRate(r.id)} className="text-red-500 hover:text-red-700"><Icons.Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Warehouse Modal */}
        {showWarehouseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="font-bold text-lg text-joy-gray-900 mb-4">{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1">Warehouse Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., China Warehouse" className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1">Code</label>
                  <input type="text" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g., CN, US, BR" className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1">Country</label>
                  <input type="text" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="e.g., China" className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.isDefault} onChange={e => setFormData({ ...formData, isDefault: e.target.checked })} className="w-4 h-4" />
                    <span className="text-sm text-joy-gray-700">Default warehouse</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4" />
                    <span className="text-sm text-joy-gray-700">Active</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button onClick={handleSaveWarehouse} className="flex-1">Save</Button>
                <Button variant="secondary" onClick={() => setShowWarehouseModal(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* Shipping Rate Modal */}
        {showRateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="font-bold text-lg text-joy-gray-900 mb-4">{editingRate ? 'Edit Shipping Rate' : 'Add Shipping Rate'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1">Warehouse</label>
                  <select value={rateData.warehouseId} onChange={e => setRateData({ ...rateData, warehouseId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1">Country</label>
                  <select value={rateData.countryCode} onChange={e => { const c = PRESET_COUNTRIES.find(p => p.code === e.target.value); setRateData({ ...rateData, countryCode: e.target.value, countryName: c?.name || '' }) }} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select country</option>
                    {PRESET_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1">Shipping Cost ($)</label>
                    <input type="number" step="0.01" value={rateData.shippingCost} onChange={e => setRateData({ ...rateData, shippingCost: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1">Cost per Kg ($)</label>
                    <input type="number" step="0.01" value={rateData.costPerKg} onChange={e => setRateData({ ...rateData, costPerKg: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-1">Estimated Days</label>
                  <input type="text" value={rateData.estimatedDays} onChange={e => setRateData({ ...rateData, estimatedDays: e.target.value })} placeholder="e.g., 15-20" className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button onClick={handleSaveRate} className="flex-1">Save</Button>
                <Button variant="secondary" onClick={() => setShowRateModal(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

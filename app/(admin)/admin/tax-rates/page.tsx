'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { adminFetch } from '@/lib/adminFetch'

interface TaxRate {
  id: string
  countryCode: string
  countryName: string
  rate: number
  region: string
  isActive: boolean
}

const regions = [
  { code: 'EU', name: '欧盟', flag: '🇪🇺' },
  { code: 'NORTH_AMERICA', name: '北美', flag: '🌎' },
  { code: 'UK', name: '英国', flag: '🇬🇧' },
  { code: 'OCEANIA', name: '大洋洲', flag: '🌏' },
  { code: 'ASIA', name: '亚洲', flag: '🌏' },
  { code: 'OTHER', name: '其他', flag: '🌐' },
  { code: 'COMPLEX', name: '暂不开放', flag: '🚫' },
]

export default function TaxRatesPage() {
  const router = useRouter()
  const [rates, setRates] = useState<TaxRate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [batchRegion, setBatchRegion] = useState('')
  const [batchRate, setBatchRate] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAuth()
    fetchRates()
  }, [])

  const checkAuth = () => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) {
      router.push('/login')
      return
    }
    try {
      const user = JSON.parse(userStr)
      if (user.role !== 'ADMIN') {
        router.push('/login')
        return
      }
    } catch {
      router.push('/login')
    }
  }

  const fetchRates = async () => {
    try {
      const res = await adminFetch('/api/admin/tax-rates')
      const data = await res.json()
      if (data.success) {
        setRates(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch rates:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (rate: TaxRate) => {
    setEditingId(rate.id)
    setEditValue((rate.rate * 100).toFixed(1))
  }

  const handleSave = async (id: string) => {
    setSaving(true)
    try {
      const rate = rates.find(r => r.id === id)
      const newRate = parseFloat(editValue) / 100
      const res = await adminFetch('/api/admin/tax-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          countryCode: rate?.countryCode,
          countryName: rate?.countryName,
          rate: newRate,
          region: rate?.region,
          isActive: rate?.isActive,
        })
      })
      const data = await res.json()
      if (data.success) {
        setRates(prev => prev.map(r => r.id === id ? { ...r, rate: newRate } : r))
        setEditingId(null)
        showMessage('保存成功')
      } else {
        showMessage('保存失败')
      }
    } catch (err) {
      showMessage('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (id: string) => {
    const rate = rates.find(r => r.id === id)
    if (!rate) return
    try {
      const res = await adminFetch('/api/admin/tax-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          countryCode: rate.countryCode,
          countryName: rate.countryName,
          rate: rate.rate,
          region: rate.region,
          isActive: !rate.isActive,
        })
      })
      const data = await res.json()
      if (data.success) {
        setRates(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r))
        showMessage(rate.isActive ? '已禁用' : '已启用')
      }
    } catch (err) {
      showMessage('操作失败')
    }
  }

  const handleBatchUpdate = async () => {
    if (!batchRegion || !batchRate) {
      showMessage('请选择地区并输入税率')
      return
    }
    setSaving(true)
    try {
      const ratesToUpdate = rates.filter(r => r.region === batchRegion)
      const newRate = parseFloat(batchRate) / 100
      const res = await adminFetch('/api/admin/tax-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rates: ratesToUpdate.map(r => ({ id: r.id, rate: newRate, isActive: true }))
        })
      })
      const data = await res.json()
      if (data.success) {
        setRates(prev => prev.map(r => 
          r.region === batchRegion ? { ...r, rate: newRate, isActive: true } : r
        ))
        showMessage(`${batchRegion} 地区税率已更新为 ${batchRate}%`)
        setBatchRegion('')
        setBatchRate('')
      } else {
        showMessage('批量更新失败')
      }
    } catch (err) {
      showMessage('批量更新失败')
    } finally {
      setSaving(false)
    }
  }

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const groupedRates = regions.map(region => ({
    ...region,
    countries: rates.filter(r => r.region === region.code)
  })).filter(g => g.countries.length > 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">税率设置</h1>
            <p className="text-joy-gray-600 mt-1">设置各国 VAT/消费税率，结账时自动计算</p>
          </div>

          {/* Message */}
          {message && (
            <div className="mb-4 px-4 py-3 bg-joy-orange/10 text-joy-orange rounded-xl">
              {message}
            </div>
          )}

          {/* Batch Update */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">快速批量设置</h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">选择地区</label>
                <select
                  value={batchRegion}
                  onChange={e => setBatchRegion(e.target.value)}
                  className="px-3 py-2 border border-joy-gray-200 rounded-lg focus:outline-none focus:border-joy-orange"
                >
                  <option value="">选择地区...</option>
                  {regions.map(r => (
                    <option key={r.code} value={r.code}>{r.flag} {r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-joy-gray-700 mb-1">税率 (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={batchRate}
                  onChange={e => setBatchRate(e.target.value)}
                  placeholder="例如：21"
                  className="w-32"
                />
              </div>
              <Button onClick={handleBatchUpdate} disabled={saving || !batchRegion || !batchRate}>
                {saving ? '保存中...' : '批量应用'}
              </Button>
            </div>
          </div>

          {/* Rates by Region */}
          <div className="space-y-6">
            {groupedRates.map(group => (
              <div key={group.code} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-joy-gray-100 flex items-center gap-2">
                  <span className="text-2xl">{group.flag}</span>
                  <h2 className="font-semibold text-lg text-joy-gray-900">{group.name}</h2>
                  <span className="text-sm text-joy-gray-500">({group.countries.length} 个国家)</span>
                </div>
                <div className="divide-y divide-joy-gray-100">
                  {group.countries.map(rate => (
                    <div key={rate.id} className="px-6 py-3 flex items-center justify-between hover:bg-joy-gray-50">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-joy-gray-900 w-24">{rate.countryCode}</span>
                        <span className="text-joy-gray-600">{rate.countryName}</span>
                        {!rate.isActive && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">已禁用</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {editingId === rate.id ? (
                          <>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              className="w-24"
                              autoFocus
                            />
                            <span className="text-joy-gray-500">%</span>
                            <Button size="sm" onClick={() => handleSave(rate.id)} disabled={saving}>
                              确定
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              取消
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-joy-orange w-16 text-right">
                              {(rate.rate * 100).toFixed(1)}%
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(rate)}>
                              <Icons.Edit size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleActive(rate.id)}
                              className={rate.isActive ? 'text-green-600' : 'text-gray-400'}
                            >
                              {rate.isActive ? '禁用' : '启用'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

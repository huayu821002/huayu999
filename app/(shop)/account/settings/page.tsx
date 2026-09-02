'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { countries } from '@/lib/countries'
import { cn } from '@/lib/utils'
import { getSavedAddresses, saveAddresses, getStoredAuth, type SavedAddress } from '@/lib/addresses'

const EMPTY_FORM = {
  label: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: 'United States',
  isDefault: false,
}

export default function AccountSettingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [addresses, setAddresses] = useState<SavedAddress[]>([])

  // Poll localStorage for changes (handles both same-tab and cross-tab updates)
  const readFromStorage = useCallback(() => {
    const auth = getStoredAuth()
    if (!auth.isAuthenticated) {
      router.push('/login')
      return
    }
    setUser(auth.user)
    setAddresses(getSavedAddresses())
    setIsLoading(false)
  }, [router])

  useEffect(() => {
    readFromStorage()
    const interval = setInterval(readFromStorage, 500)
    return () => clearInterval(interval)
  }, [readFromStorage])

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!form.label.trim()) errors.label = 'Label is required'
    if (!form.firstName.trim()) errors.firstName = 'First name is required'
    if (!form.lastName.trim()) errors.lastName = 'Last name is required'
    if (!form.email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email'
    if (!form.phone.trim()) errors.phone = 'Phone is required'
    if (!form.address.trim()) errors.address = 'Address is required'
    if (!form.city.trim()) errors.city = 'City is required'
    if (!form.state.trim()) errors.state = 'State is required'
    if (!form.zip.trim()) errors.zip = 'ZIP is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveAddress = () => {
    if (!validateForm()) return
    setIsSaving(true)
    setTimeout(() => {
      let updated: SavedAddress[]
      if (editingId) {
        updated = addresses.map(a => a.id === editingId ? { ...form, id: editingId } : a)
        setEditingId(null)
      } else {
        updated = [...addresses, { ...form, id: Date.now().toString() }]
        setShowAddForm(false)
      }
      // If setting as default, clear other defaults
      if (form.isDefault) {
        updated = updated.map(a => ({ ...a, isDefault: a.id === (editingId ?? updated[updated.length - 1].id) }))
      }
      setAddresses(updated)
      saveAddresses(updated)
      setForm({ ...EMPTY_FORM })
      setFormErrors({})
      setIsSaving(false)
    }, 500)
  }

  const handleEdit = (addr: SavedAddress) => {
    setForm({ ...addr, isDefault: addr.isDefault ?? false })
    setEditingId(addr.id)
    setShowAddForm(true)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this address?')) return
    const updated = addresses.filter(a => a.id !== id)
    setAddresses(updated)
    saveAddresses(updated)
  }

  const handleSetDefault = (id: string) => {
    const updated = addresses.map(a => ({ ...a, isDefault: a.id === id }))
    setAddresses(updated)
    saveAddresses(updated)
  }

  const handleCancel = () => {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    setShowAddForm(false)
    setFormErrors({})
  }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <CartDrawer />
      <FloatingButtons />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Back */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/account" className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.ChevronLeft size={20} /></Link>
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Account Settings</h1>
              <p className="text-sm text-joy-gray-500 mt-0.5">Manage your profile and saved addresses</p>
            </div>
          </div>

          {/* Profile Section */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">Profile Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Full Name" defaultValue={user?.name || ''} />
              <Input label="Email" defaultValue={user?.email || ''} type="email" />
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setIsSaving(true)} isLoading={isSaving}>Save Changes</Button>
            </div>
          </div>

          {/* Saved Addresses Section */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-joy-gray-900">Saved Addresses</h2>
              {!showAddForm && (
                <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
                  <Icons.Plus size={16} className="mr-1" />
                  Add Address
                </Button>
              )}
            </div>

            {/* Address List */}
            {addresses.length > 0 && (
              <div className="space-y-3 mb-4">
                {addresses.map(addr => (
                  <div key={addr.id} className={cn(
                    'border-2 rounded-xl p-4 transition-colors',
                    addr.isDefault ? 'border-joy-orange bg-joy-orange/5' : 'border-joy-gray-100'
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-joy-gray-900">{addr.label}</span>
                          {addr.isDefault && (
                            <span className="text-xs bg-joy-orange text-white px-2 py-0.5 rounded-full">Default</span>
                          )}
                        </div>
                        <p className="text-sm text-joy-gray-600">{addr.firstName} {addr.lastName}</p>
                        <p className="text-sm text-joy-gray-500">{addr.address}, {addr.city}, {addr.state} {addr.zip}</p>
                        <p className="text-sm text-joy-gray-400">{addr.country}</p>
                        <p className="text-sm text-joy-gray-400 mt-1">{addr.phone} | {addr.email}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!addr.isDefault && (
                          <button
                            onClick={() => handleSetDefault(addr.id)}
                            className="p-1.5 text-joy-gray-400 hover:text-joy-orange rounded-lg hover:bg-joy-orange/10 transition-colors"
                            title="Set as default"
                          >
                            <Icons.MapPin size={16} />
                          </button>
                        )}
                        <button onClick={() => handleEdit(addr)} className="p-1.5 text-joy-gray-400 hover:text-joy-orange rounded-lg hover:bg-joy-orange/10 transition-colors">
                          <Icons.Edit3 size={16} />
                        </button>
                        <button onClick={() => handleDelete(addr.id)} className="p-1.5 text-joy-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                          <Icons.Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addresses.length === 0 && !showAddForm && (
              <div className="text-center py-8">
                <Icons.MapPin size={40} className="mx-auto text-joy-gray-300 mb-3" />
                <p className="text-joy-gray-500 mb-3">No saved addresses yet</p>
                <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>Add your first address</Button>
              </div>
            )}

            {/* Add/Edit Form */}
            {showAddForm && (
              <div className="border-t border-joy-gray-100 pt-6 mt-4">
                <h3 className="font-medium text-joy-gray-900 mb-4">
                  {editingId ? 'Edit Address' : 'Add New Address'}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Address Label *" placeholder="e.g. Home, Office" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} error={formErrors.label} />
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} className="accent-joy-orange w-4 h-4" />
                        <span className="text-joy-gray-600">Set as default</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="First Name *" placeholder="John" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} error={formErrors.firstName} />
                    <Input label="Last Name *" placeholder="Smith" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} error={formErrors.lastName} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Email *" type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} error={formErrors.email} />
                    <Input label="Phone *" type="tel" placeholder="+1 234 567 8900" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} error={formErrors.phone} />
                  </div>
                  <Input label="Address *" placeholder="123 Main St" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} error={formErrors.address} />
                  <div className="grid grid-cols-3 gap-4">
                    <Input label="City *" placeholder="New York" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} error={formErrors.city} />
                    <Input label="State *" placeholder="NY" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} error={formErrors.state} />
                    <Input label="ZIP *" placeholder="10001" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} error={formErrors.zip} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">Country / Region *</label>
                    <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border-2 border-joy-gray-200 text-sm focus:border-joy-orange focus:outline-none">
                      {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                    <Button onClick={handleSaveAddress} isLoading={isSaving}>
                      {editingId ? 'Update Address' : 'Save Address'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => setIsSaving(false), 1000)
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">Settings</h1>
            <Link href="/admin/dashboard"><Button variant="secondary">← Back to Dashboard</Button></Link>
          </div>

          <div className="space-y-6">
            {/* Store Info */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-lg text-joy-gray-900 mb-6 flex items-center gap-2">
                <Icons.Store size={20} className="text-joy-orange" />
                Store Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Store Name" defaultValue="Fiestaflare Wholesaler" />
                <Input label="Store Email" defaultValue="admin@fiestaflare.com" type="email" />
                <Input label="Store Phone" defaultValue="+1 (555) 123-4567" />
                <Input label="Store Currency" defaultValue="USD" />
              </div>
            </div>

            {/* Business Address */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-lg text-joy-gray-900 mb-6 flex items-center gap-2">
                <Icons.MapPin size={20} className="text-joy-orange" />
                Business Address
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <Input label="Street Address" defaultValue="123 Business Street" />
                <div className="grid grid-cols-3 gap-4">
                  <Input label="City" defaultValue="Los Angeles" />
                  <Input label="State" defaultValue="CA" />
                  <Input label="ZIP Code" defaultValue="90001" />
                </div>
                <Input label="Country" defaultValue="United States" />
              </div>
            </div>

            {/* Shipping Settings */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-lg text-joy-gray-900 mb-6 flex items-center gap-2">
                <Icons.Truck size={20} className="text-joy-orange" />
                Shipping Settings
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Default Shipping Cost (USD)" defaultValue="9.99" type="number" />
                <Input label="Free Shipping Threshold (USD)" defaultValue="99" type="number" />
                <Input label="Estimated Delivery Days" defaultValue="7-14 business days" />
              </div>
            </div>

            {/* Tax Settings */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-lg text-joy-gray-900 mb-6 flex items-center gap-2">
                <Icons.Percent size={20} className="text-joy-orange" />
                Tax Settings
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Tax Rate (%)" defaultValue="8.5" type="number" />
                <Input label="Tax ID / EIN" defaultValue="12-3456789" />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} isLoading={isSaving}>
                {isSaving ? 'Saving...' : 'Save All Settings'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

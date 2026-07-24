'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'

export default function AccountSettingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (!userStr) { router.push('/login'); return }
    try {
      setUser(JSON.parse(userStr))
    } catch { router.push('/login') }
    setIsLoading(false)
  }, [router])

  const handleSave = () => { setIsSaving(true); setTimeout(() => setIsSaving(false), 1000) }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/account" className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.ChevronLeft size={20} /></Link>
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">Account Settings</h1>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
            <h2 className="font-semibold text-lg text-joy-gray-900">Profile Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Full Name" defaultValue={user?.name || ''} />
              <Input label="Email" defaultValue={user?.email || ''} type="email" />
            </div>
            <Input label="Company" placeholder="Your company name" />
            <Input label="Phone" placeholder="+1 234 567 8900" type="tel" />
            <div className="flex justify-end">
              <Button onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { adminFetch } from '@/lib/adminFetch'

interface Customer {
  id: string
  name: string
  email: string
  role: string
  company: string
  currency: string
  createdAt: string
}

export default function AdminCustomersPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')

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
    fetchCustomers()
  }, [isAdmin])

  const fetchCustomers = async () => {
    try {
      const res = await adminFetch('/api/admin/customers')
      const data = await res.json()
      if (data.success) setCustomers(data.data)
    } catch (err) { console.error(err) }
  }

  if (isLoading) return <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>
  if (!isAdmin) return null

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Customers</h1>
              <p className="text-joy-gray-600">{customers.length} customers</p>
            </div>
            <Link href="/admin/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-joy-gray-100">
              <div className="relative max-w-md">
                <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-joy-gray-400" />
                <input type="text" placeholder="Search customers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none focus:ring-2 focus:ring-joy-orange/20" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-joy-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Customer</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Email</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Role</th>
                    <th className="text-left text-xs font-medium text-joy-gray-500 uppercase tracking-wider px-6 py-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-joy-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-joy-gray-500">No customers found</td></tr>
                  ) : filtered.map((customer) => (
                    <tr key={customer.id} className="hover:bg-joy-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-joy-orange/10 text-joy-orange font-bold flex items-center justify-center">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-joy-gray-900">{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-joy-gray-600">{customer.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${customer.role === 'ADMIN' ? 'bg-joy-orange/10 text-joy-orange' : 'bg-joy-green/10 text-joy-green'}`}>
                          {customer.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-joy-gray-500">{new Date(customer.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

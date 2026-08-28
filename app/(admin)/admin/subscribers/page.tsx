'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { adminFetch } from '@/lib/adminFetch'
import { Icons } from '@/components/ui/Icons'
import Link from 'next/link'

interface Subscriber {
  id: string
  email: string
  isActive: boolean
  createdAt: string
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubscribers()
  }, [])

  const fetchSubscribers = async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/subscribers')
      const data = await res.json()
      setSubscribers(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (id: string, currentActive: boolean) => {
    // For now just refresh - in production would call a PATCH endpoint
    await fetchSubscribers()
  }

  const deleteSubscriber = async (id: string) => {
    if (!confirm('Delete this subscriber?')) return
    // For now just refresh - in production would call DELETE endpoint
    await fetchSubscribers()
  }

  const exportCSV = () => {
    const csv = [
      ['Email', 'Status', 'Subscribed Date'],
      ...subscribers.map(s => [
        s.email,
        s.isActive ? 'Active' : 'Inactive',
        new Date(s.createdAt).toLocaleDateString(),
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subscribers.csv'
    a.click()
  }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-joy-gray-900">Newsletter Subscribers</h1>
            <p className="text-sm text-joy-gray-500">{subscribers.length} total subscribers</p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-joy-orange text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Icons.Download size={18} />
            Export CSV
          </button>
        </div>

        <div className="bg-white rounded-xl border border-joy-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-joy-gray-400">Loading...</div>
          ) : subscribers.length === 0 ? (
            <div className="p-8 text-center text-joy-gray-400">
              <Icons.Mail size={48} className="mx-auto mb-4 opacity-30" />
              <p>No subscribers yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-joy-gray-50 border-b border-joy-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-joy-gray-600">Email</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-joy-gray-600">Status</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-joy-gray-600">Subscribed</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-joy-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-joy-gray-100">
                {subscribers.map(sub => (
                  <tr key={sub.id} className="hover:bg-joy-gray-50">
                    <td className="px-6 py-4">
                      <a href={`mailto:${sub.email}`} className="text-joy-orange hover:underline">
                        {sub.email}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        sub.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {sub.isActive ? <Icons.Check size={12} /> : null}
                        {sub.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-joy-gray-500">
                      {new Date(sub.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteSubscriber(sub.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        <Icons.Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}

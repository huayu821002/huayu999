'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { adminFetch } from '@/lib/adminFetch'

interface Contact {
  id: string
  name: string
  email: string
  phone: string
  subject: string
  message: string
  isRead: boolean
  createdAt: string
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/contacts')
      const data = await res.json()
      setContacts(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchContacts() }, [])

  const markAsRead = async (id: string) => {
    await adminFetch(`/api/admin/contacts/${id}`, { method: 'PATCH' })
    setContacts(cs => cs.map(c => c.id === id ? { ...c, isRead: true } : c))
    if (selected?.id === id) setSelected(s => s ? { ...s, isRead: true } : s)
  }

  const deleteContact = async (id: string) => {
    if (!confirm('Delete this message?')) return
    await adminFetch(`/api/admin/contacts/${id}`, { method: 'DELETE' })
    setContacts(cs => cs.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const filtered = filter === 'unread' ? contacts.filter(c => !c.isRead) : contacts
  const unreadCount = contacts.filter(c => !c.isRead).length

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-joy-gray-900">Contact Messages</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-joy-orange font-medium">{unreadCount} unread message{unreadCount > 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-joy-orange text-white' : 'bg-white text-joy-gray-600 border border-joy-gray-200 hover:bg-joy-gray-50'}`}
            >
              All ({contacts.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'unread' ? 'bg-joy-orange text-white' : 'bg-white text-joy-gray-600 border border-joy-gray-200 hover:bg-joy-gray-50'}`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Contact List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-joy-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-joy-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-joy-gray-400">No messages</div>
            ) : (
              <div className="divide-y divide-joy-gray-100">
                {filtered.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => { setSelected(contact); if (!contact.isRead) markAsRead(contact.id) }}
                    className={`w-full text-left p-4 hover:bg-joy-gray-50 transition-colors ${selected?.id === contact.id ? 'bg-orange-50' : ''} ${!contact.isRead ? 'border-l-4 border-joy-orange' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${!contact.isRead ? 'font-bold text-joy-gray-900' : 'text-joy-gray-700'}`}>{contact.name}</p>
                        <p className="text-xs text-joy-gray-500 truncate">{contact.subject || 'No subject'}</p>
                        <p className="text-xs text-joy-gray-400 mt-0.5">
                          {new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!contact.isRead && (
                        <span className="w-2 h-2 bg-joy-orange rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-joy-gray-200 overflow-hidden">
            {!selected ? (
              <div className="flex items-center justify-center h-64 text-joy-gray-400">
                Select a message to view
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-joy-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-joy-gray-900">{selected.name}</h2>
                    <p className="text-sm text-joy-gray-500">{selected.email}</p>
                    {selected.phone && <p className="text-sm text-joy-gray-500">{selected.phone}</p>}
                    {selected.subject && <p className="text-sm font-medium text-joy-gray-700 mt-1">Subject: {selected.subject}</p>}
                    <p className="text-xs text-joy-gray-400 mt-1">
                      {new Date(selected.createdAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selected.isRead ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full">Read</span>
                    ) : (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">New</span>
                    )}
                    <button
                      onClick={() => deleteContact(selected.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2.5 py-1 rounded-full border border-red-200 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="bg-joy-gray-50 rounded-xl p-4">
                  <p className="text-sm text-joy-gray-700 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                </div>
                <div className="mt-4 flex gap-3">
                  <a
                    href={`mailto:${selected.email}?subject=Re: ${selected.subject || 'Contact from Fiestaflare'}`}
                    className="px-4 py-2 bg-joy-orange text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Reply via Email
                  </a>
                  {selected.phone && (
                    <a
                      href={`tel:${selected.phone}`}
                      className="px-4 py-2 bg-white text-joy-gray-700 text-sm font-medium rounded-lg border border-joy-gray-200 hover:bg-joy-gray-50 transition-colors"
                    >
                      Call
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

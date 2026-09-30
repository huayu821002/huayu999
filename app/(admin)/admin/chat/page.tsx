'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Icons } from '@/components/ui/Icons'

interface Conversation {
  id: string
  visitorEmail: string | null
  visitorName: string | null
  status: string
  lastMessage: string | null
  lastMessageAt: string
  messageCount: number
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
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
      setIsAdmin(true)
    } catch {
      router.push('/login')
    }
  }, [router])

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations?status=' + (filter === 'all' ? '' : filter))
      const data = await res.json()
      if (data.success) {
        setConversations(data.data)
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [filter])

  // Auto-refresh conversations every 5 seconds
  useEffect(() => {
    if (!isAdmin) return
    const interval = setInterval(() => {
      fetchConversations()
    }, 5000)
    return () => clearInterval(interval)
  }, [isAdmin, filter])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-green-100 text-green-700'
      case 'CLOSED': return 'bg-gray-100 text-gray-500'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Service</h1>
            <p className="text-sm text-gray-500 mt-1">
              {conversations.filter(c => c.status === 'OPEN').length} open conversations
            </p>
          </div>
          <button
            onClick={() => fetchConversations()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            <Icons.RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { key: 'all', label: 'All' },
            { key: 'OPEN', label: 'Open' },
            { key: 'CLOSED', label: 'Closed' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-joy-orange text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : !isAdmin ? (
            <div className="p-8 text-center text-gray-500">Checking permissions...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">💬</div>
              <p>No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => router.push(`/admin/chat/${conv.id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(conv.status)}`}>
                          {conv.status}
                        </span>
                        {conv.visitorEmail && (
                          <span className="text-sm text-gray-600">{conv.visitorEmail}</span>
                        )}
                        {conv.visitorName && (
                          <span className="text-sm text-gray-900 font-medium">{conv.visitorName}</span>
                        )}
                        {!conv.visitorEmail && !conv.visitorName && (
                          <span className="text-sm text-gray-400">Anonymous</span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className="text-sm text-gray-500 mt-1 truncate">{conv.lastMessage}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

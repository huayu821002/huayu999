'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'

interface Message {
  id: string
  content: string
  senderType: 'USER' | 'BOT' | 'ADMIN'
  senderId: string | null
  isRead: boolean
  createdAt: string
}

interface Conversation {
  id: string
  visitorEmail: string | null
  visitorName: string | null
  status: string
  lastMessage: string | null
  lastMessageAt: string
  messages: Message[]
}

export default function ChatConversationPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [lastMsgCount, setLastMsgCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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

  const fetchConversation = async () => {
    try {
      const res = await fetch(`/api/chat/conversations/${id}`)
      const data = await res.json()
      if (data.success) {
        const prevCount = lastMsgCount
        const newCount = data.data.messages?.length || 0
        
        // Check if new USER message arrived (notification)
        if (newCount > prevCount && prevCount > 0) {
          const newMsgs = data.data.messages.slice(prevCount)
          const hasNewUserMsg = newMsgs.some((m: Message) => m.senderType === 'USER')
          
          if (hasNewUserMsg) {
            // Play sound
            try {
              const audio = new Audio('https://www.soundjay.com/buttons/beep-07.mp3')
              audio.volume = 0.5
              audio.play().catch(() => {})
            } catch {}
            
            // Browser notification if not focused
            if (document.hidden) {
              if (Notification.permission === 'granted') {
                new Notification('💬 New visitor message!', {
                  body: newMsgs.find((m: Message) => m.senderType === 'USER')?.content?.substring(0, 80) || '',
                })
              } else if (Notification.permission === 'default') {
                Notification.requestPermission()
              }
            }
          }
        }
        
        setLastMsgCount(newCount)
        setConversation(data.data)
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversation()
  }, [id])

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!id) return
    
    const pollInterval = setInterval(() => {
      fetchConversation()
    }, 3000)
    
    return () => clearInterval(pollInterval)
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/chat/conversations/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setReply('')
        fetchConversation()
      }
    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setSending(false)
    }
  }

  const closeConversation = async () => {
    try {
      await fetch(`/api/chat/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      })
      router.push('/admin/chat')
    } catch (err) {
      console.error('Close error:', err)
    }
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-12 text-gray-500">Conversation not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => router.push('/admin/chat')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Chat List
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {conversation.visitorName || conversation.visitorEmail || 'Anonymous'}
              </h1>
              <p className="text-sm text-gray-500">
                {conversation.visitorEmail || 'No email'}
                {conversation.visitorName && conversation.visitorEmail && ` - ${conversation.visitorName}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {conversation.status === 'OPEN' && (
              <button
                onClick={closeConversation}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Close Chat
              </button>
            )}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              conversation.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {conversation.status}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4"
             style={{ height: 'calc(100vh - 280px)', maxHeight: '500px' }}>
          <div className="h-full overflow-y-auto p-4 space-y-3">
            {conversation.messages.length === 0 && (
              <div className="text-center text-gray-400 py-8">No messages yet</div>
            )}
            {conversation.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderType === 'USER' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                  msg.senderType === 'USER'
                    ? 'bg-joy-orange text-white rounded-br-md'
                    : msg.senderType === 'ADMIN'
                    ? 'bg-blue-500 text-white rounded-bl-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md border border-gray-200'
                }`}>
                  <p>{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.senderType === 'USER' ? 'text-white/70' : 'text-gray-400'
                  }`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Reply input */}
        {conversation.status === 'OPEN' ? (
          <form onSubmit={sendReply} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!reply.trim() || sending}
                className="px-6 py-2 bg-joy-orange text-white rounded-xl font-medium hover:bg-joy-orange/90 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4 text-gray-400 text-sm bg-gray-100 rounded-xl">
            This conversation is closed
          </div>
        )}
      </div>
    </div>
  )
}

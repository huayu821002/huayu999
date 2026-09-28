'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  id: string
  content: string
  senderType: 'USER' | 'BOT' | 'ADMIN'
  createdAt: string
}

interface ChatState {
  conversationId: string | null
  messages: Message[]
  isOpen: boolean
  isLoading: boolean
  isTyping: boolean
}

export function ChatWidget() {
  const [state, setState] = useState<ChatState>({
    conversationId: null,
    messages: [],
    isOpen: false,
    isLoading: false,
    isTyping: false,
  })
  const [input, setInput] = useState('')
  const [visitorEmail, setVisitorEmail] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [state.messages])

  // Focus input when chat opens
  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [state.isOpen])

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || state.isLoading) return

    const userMessage = input.trim()
    setInput('')
    setState(s => ({ ...s, isLoading: true, isTyping: true }))

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId: state.conversationId,
          visitorEmail: visitorEmail || undefined,
          visitorName: undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setState(s => ({
          ...s,
          conversationId: data.data.conversationId,
          messages: [
            ...s.messages,
            { id: Date.now() + 'u', content: userMessage, senderType: 'USER', createdAt: new Date().toISOString() },
            { id: Date.now() + 'b', content: data.data.reply, senderType: 'BOT', createdAt: new Date().toISOString() },
          ],
          isLoading: false,
          isTyping: false,
        }))

        // Show email form after first exchange if no email
        if (!visitorEmail && data.data.reply) {
          setShowEmailForm(true)
        }
      }
    } catch (err) {
      console.error('Send error:', err)
      setState(s => ({ ...s, isLoading: false, isTyping: false }))
    } finally {
      // Safety fallback: always reset loading state after 15s
      setTimeout(() => {
        setState(s => { if (s.isLoading) return { ...s, isLoading: false, isTyping: false }; return s })
      }, 15000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {state.isOpen && (
        <div className="mb-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200"
             style={{ height: '500px', maxHeight: '70vh' }}>
          {/* Header */}
          <div className="bg-joy-orange text-white px-4 py-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Fiestaflare Support</h3>
              <p className="text-xs text-white/80">We typically reply within 1 hour</p>
            </div>
            <button
              onClick={() => setState(s => ({ ...s, isOpen: false }))}
              className="text-white/80 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {state.messages.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <div className="text-4xl mb-2">👋</div>
                <p className="text-sm">Hi there! How can we help you today?</p>
                <p className="text-xs mt-1">Ask about shipping, returns, products, or anything else!</p>
              </div>
            )}

            {state.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === 'USER' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                    msg.senderType === 'USER'
                      ? 'bg-joy-orange text-white rounded-br-md'
                      : msg.senderType === 'ADMIN'
                      ? 'bg-blue-500 text-white rounded-bl-md'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {state.isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {showEmailForm && !visitorEmail && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-3 py-2 max-w-[80%]">
                  <p className="text-sm text-gray-700 mb-2">For faster assistance, please share your email:</p>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={visitorEmail}
                    onChange={(e) => setVisitorEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                disabled={state.isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || state.isLoading}
                className="px-4 py-2 bg-joy-orange text-white rounded-xl text-sm font-medium hover:bg-joy-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setState(s => ({ ...s, isOpen: !s.isOpen }))}
        className="w-14 h-14 bg-joy-orange text-white rounded-full shadow-lg hover:bg-joy-orange/90 transition-all flex items-center justify-center hover:scale-105"
        aria-label="Chat with us"
      >
        {state.isOpen ? (
          <span className="text-2xl">×</span>
        ) : (
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
    </div>
  )
}

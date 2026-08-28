'use client'

import { useState } from 'react'
import { Icons } from '@/components/ui/Icons'

export function Newsletter() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    // Simulate subscription - in production would call an API
    setTimeout(() => {
      setStatus('success')
      setEmail('')
    }, 1000)
  }

  return (
    <section className="py-16 bg-gradient-to-r from-orange-500 to-orange-600">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <Icons.Mail size={40} className="mx-auto mb-4 text-white/80" />
        <h2 className="font-display text-2xl font-bold text-white mb-2">
          Stay Updated
        </h2>
        <p className="text-white/80 mb-6">
          Subscribe for new products, exclusive deals & wholesale tips
        </p>
        {status === 'success' ? (
          <div className="bg-white/20 rounded-xl p-4">
            <Icons.Check size={24} className="mx-auto mb-2 text-white" />
            <p className="text-white font-medium">Subscribed successfully!</p>
            <button onClick={() => setStatus('idle')} className="text-white/80 text-sm hover:text-white mt-2 underline">
              Subscribe another email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:bg-white/30"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-3 bg-white text-joy-orange font-semibold rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-50"
            >
              {status === 'loading' ? '...' : 'Subscribe'}
            </button>
          </form>
        )}
        <p className="text-white/60 text-xs mt-4">
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </section>
  )
}

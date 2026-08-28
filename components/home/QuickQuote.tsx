'use client'

import { useState } from 'react'
import { Icons } from '@/components/ui/Icons'

export function QuickQuote() {
  const [form, setForm] = useState({ productUrl: '', quantity: '', email: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Quote Request',
          email: form.email,
          subject: `Quick Quote Request - Qty: ${form.quantity}`,
          message: `Product: ${form.productUrl}\nQuantity: ${form.quantity}\n\n${form.message}`,
        }),
      })
      if (res.ok) {
        setStatus('success')
        setForm({ productUrl: '', quantity: '', email: '', message: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="py-16 bg-joy-navy text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl font-bold mb-4">
              Get a Quick Quote
            </h2>
            <p className="text-white/80 mb-6">
              Send us product links and your target quantity — we&apos;ll reply with best pricing within 24 hours.
            </p>
            <div className="space-y-4 text-sm text-white/70">
              <div className="flex items-center gap-3">
                <Icons.Check size={18} className="text-joy-orange" />
                <span>Factory direct prices</span>
              </div>
              <div className="flex items-center gap-3">
                <Icons.Check size={18} className="text-joy-orange" />
                <span>Sample orders welcome</span>
              </div>
              <div className="flex items-center gap-3">
                <Icons.Check size={18} className="text-joy-orange" />
                <span>Custom branding available</span>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
            {status === 'success' ? (
              <div className="text-center py-8">
                <Icons.Check size={48} className="mx-auto mb-4 text-joy-orange" />
                <h3 className="text-xl font-bold mb-2">Quote Request Sent!</h3>
                <p className="text-white/80">We&apos;ll get back to you within 24 hours.</p>
                <button onClick={() => setStatus('idle')} className="mt-4 text-joy-orange hover:underline text-sm">
                  Send another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-white/70 mb-1 block">Product URL(s)</label>
                  <input
                    type="text"
                    required
                    placeholder="https://fiestaflare.com/products/..."
                    value={form.productUrl}
                    onChange={e => setForm({ ...form, productUrl: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-joy-orange"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-white/70 mb-1 block">Target Quantity</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 100 pcs"
                      value={form.quantity}
                      onChange={e => setForm({ ...form, quantity: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-joy-orange"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/70 mb-1 block">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-joy-orange"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-white/70 mb-1 block">Additional Notes (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Color, size, customization needs..."
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-joy-orange resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-joy-orange hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {status === 'loading' ? 'Sending...' : 'Get Quote'}
                </button>
                {status === 'error' && (
                  <p className="text-red-400 text-sm text-center">Failed to send. Please try again.</p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface SubscribeModalProps {
  delay?: number // seconds before showing
  onClose?: () => void
}

export function SubscribeModal({ delay = 10, onClose }: SubscribeModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check if already subscribed
    const hasSubscribed = localStorage.getItem('joyhub_subscribed')
    if (hasSubscribed) return

    // Check if modal was closed recently
    const lastClosed = localStorage.getItem('joyhub_subscribe_closed')
    if (lastClosed) {
      const hoursSinceClose = (Date.now() - parseInt(lastClosed)) / (1000 * 60 * 60)
      if (hoursSinceClose < 24) return
    }

    // Show after delay
    const timer = setTimeout(() => setIsVisible(true), delay * 1000)
    return () => clearTimeout(timer)
  }, [delay])

  const handleClose = () => {
    setIsVisible(false)
    localStorage.setItem('joyhub_subscribe_closed', Date.now().toString())
    onClose?.()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Email is required')
      return
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email')
      return
    }

    setIsSubmitting(true)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Store subscription
      localStorage.setItem('joyhub_subscribed', 'true')
      localStorage.setItem('joyhub_subscriber_email', email)
      
      setIsSubmitted(true)
      
      // Auto close after success
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg animate-bounce-in">
        <div className="subscribe-modal">
          <div className="subscribe-modal-inner">
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 p-2 text-joy-gray-400 hover:text-joy-gray-600 transition-colors"
              aria-label="Close"
            >
              <Icons.X size={20} />
            </button>

            {isSubmitted ? (
              // Success State
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-joy-green/20 flex items-center justify-center mx-auto mb-4">
                  <Icons.Check size={32} className="text-joy-green" />
                </div>
                <h3 className="font-display font-bold text-2xl text-joy-gray-900 mb-2">
                  You're In! 🎉
                </h3>
                <p className="text-joy-gray-600 mb-4">
                  Check your inbox for the <strong>2026 Q3 Trending Products List</strong> PDF.
                </p>
                <p className="text-sm text-joy-gray-500">
                  Welcome to the JoyHub family!
                </p>
              </div>
            ) : (
              // Form State
              <>
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-joy-orange to-joy-pink flex items-center justify-center mx-auto mb-4">
                    <Icons.Mail size={32} className="text-white" />
                  </div>
                  <h3 className="font-display font-bold text-2xl text-joy-gray-900 mb-2">
                    Get Our Trending Catalog
                  </h3>
                  <p className="text-joy-gray-600">
                    Subscribe now and receive the <strong>2026 Q3 Trending Products List</strong> PDF — absolutely free!
                  </p>
                </div>

                {/* What's Inside */}
                <div className="bg-joy-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-sm font-medium text-joy-gray-800 mb-3">What you'll get:</p>
                  <ul className="space-y-2">
                    {[
                      '🔥 Top 50 Trending Products for Q3',
                      '📦 Wholesale Pricing Guide',
                      '🚚 Shipping Timeline Breakdown by Region',
                      '💡 Dropshipping Success Tips',
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-joy-gray-700">
                        <Icons.Check size={16} className="text-joy-green flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input
                    type="text"
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white"
                  />
                  <Input
                    type="email"
                    placeholder="Your email address *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={error}
                    className="bg-white"
                  />
                  <Button
                    type="submit"
                    variant="south"
                    className="w-full"
                    isLoading={isSubmitting}
                  >
                    {isSubmitting ? 'Subscribing...' : 'Get My Free Catalog →'}
                  </Button>
                </form>

                {/* Privacy Note */}
                <p className="text-center text-xs text-joy-gray-500 mt-4">
                  We respect your privacy. Unsubscribe anytime.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook to manage subscribe modal visibility
export function useSubscribeModal() {
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // Only show once per session
    const hasSeenModal = sessionStorage.getItem('joyhub_modal_seen')
    if (!hasSeenModal) {
      // Will be triggered by SubscribeModal component
      sessionStorage.setItem('joyhub_modal_seen', 'true')
    }
  }, [])

  return { showModal, setShowModal }
}

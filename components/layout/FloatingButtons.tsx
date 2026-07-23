'use client'

import { useState, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'
import { getWhatsAppLink, getTikTokShareLink } from '@/lib/utils'

const WHATSAPP_NUMBER = '12025551234' // Replace with actual number

interface FloatingButtonsProps {
  productUrl?: string
  productName?: string
}

export function FloatingButtons({ productUrl, productName }: FloatingButtonsProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false)

  useEffect(() => {
    // Show after 2 seconds
    const timer = setTimeout(() => setIsVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!isVisible) return null

  const whatsappLink = getWhatsAppLink(
    WHATSAPP_NUMBER,
    productName ? `Hi! I'm interested in: ${productName}` : 'Hi! I have a question about Fiestaflare Wholesaler.'
  )

  const tiktokLink = getTikTokShareLink(
    productUrl || 'https://joyhubwholesale.com',
    productName || 'Check out these amazing products from Fiestaflare Wholesaler!'
  )

  return (
    <div className="fixed right-4 bottom-24 z-40 flex flex-col gap-3">
      {/* WhatsApp */}
      <div className="relative">
        <button
          onClick={() => setIsWhatsAppOpen(!isWhatsAppOpen)}
          className="floating-btn floating-btn-whatsapp w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          aria-label="Chat on WhatsApp"
        >
          <Icons.WhatsApp size={28} />
        </button>
        
        {isWhatsAppOpen && (
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-4 w-64 animate-fade-in">
            <h4 className="font-semibold text-joy-gray-900 mb-2">Chat with us!</h4>
            <p className="text-sm text-joy-gray-600 mb-3">
              Get instant support in English or Spanish.
            </p>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 px-4 bg-[#25D366] text-white rounded-lg font-medium text-center hover:bg-[#20bd5a] transition-colors"
            >
              Open WhatsApp
            </a>
            <button
              onClick={() => setIsWhatsAppOpen(false)}
              className="absolute top-2 right-2 p-1 text-joy-gray-400 hover:text-joy-gray-600"
            >
              <Icons.X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* TikTok */}
      <a
        href={tiktokLink}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-btn floating-btn-tiktok w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        aria-label="Share on TikTok"
      >
        <Icons.TikTok size={24} />
      </a>

      {/* Scroll to Top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="floating-btn bg-joy-gray-200 text-joy-gray-600 w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-joy-gray-300 hover:scale-110 active:scale-95 transition-all"
        aria-label="Scroll to top"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  )
}

// Cart floating button (shows mini cart preview on hover)
export function CartFloatingButton() {
  const [isOpen, setIsOpen] = useState(false)
  const { items, getSubtotal, getItemCount, currency } = useCartStore()
  const itemCount = getItemCount()
  const subtotal = getSubtotal()

  if (itemCount === 0) return null

  return (
    <div className="fixed right-4 bottom-24 lg:bottom-8 z-40">
      <button
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => useCartStore.getState().toggleCart()}
        className="floating-btn floating-btn-cart relative w-16 h-16 rounded-full shadow-xl flex items-center justify-center"
      >
        <Icons.ShoppingCart size={28} />
        <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white text-joy-orange text-sm font-bold flex items-center justify-center shadow-lg">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      </button>

      {/* Mini Cart Preview */}
      {isOpen && (
        <div 
          className="absolute bottom-full right-0 mb-3 bg-white rounded-xl shadow-2xl p-4 w-72 animate-fade-in"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <h4 className="font-semibold text-joy-gray-900 mb-3">Your Cart</h4>
          <div className="space-y-2 max-h-48 overflow-auto">
            {items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-joy-gray-100 overflow-hidden flex-shrink-0">
                  <img
                    src={item.product.images[0] || '/placeholder.png'}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-joy-gray-900 truncate">
                    {item.product.name}
                  </p>
                  <p className="text-xs text-joy-gray-500">
                    Qty: {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold text-joy-orange">
                  ${(item.product.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
            {items.length > 3 && (
              <p className="text-xs text-joy-gray-500 text-center">
                + {items.length - 3} more items
              </p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-joy-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-joy-gray-600">Subtotal:</span>
              <span className="font-bold text-joy-gray-900">${subtotal.toFixed(2)}</span>
            </div>
            <button
              onClick={() => useCartStore.getState().toggleCart()}
              className="w-full py-2.5 bg-gradient-to-r from-joy-orange to-joy-pink text-white rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              View Cart & Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Import useCartStore
import { useCartStore } from '@/lib/store'

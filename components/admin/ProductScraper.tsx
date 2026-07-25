'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { cn } from '@/lib/utils'

interface ScrapedProduct {
  title: string
  description: string
  price: string
  currency: string
  images: string[]
  source: string
  originalUrl: string
}

interface ProductScraperProps {
  onScraped: (product: ScrapedProduct) => void
  onCancel: () => void
}

export function ProductScraper({ onScraped, onCancel }: ProductScraperProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ScrapedProduct | null>(null)

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a product URL')
      return
    }

    setIsLoading(true)
    setError('')
    setPreview(null)

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (data.success) {
        setPreview(data.data)
        if (!data.data.title && !data.data.description) {
          setError('Could not extract product information. The site may not be supported.')
        }
      } else {
        setError(data.error || 'Failed to scrape product')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseProduct = () => {
    if (preview) {
      onScraped(preview)
    }
  }

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-joy-gray-700">
          Product URL
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
            placeholder="https://..."
            className="flex-1 px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none text-sm"
          />
          <Button 
            onClick={handleScrape}
            isLoading={isLoading}
            disabled={!url.trim()}
          >
            <Icons.Download size={18} className="mr-2" />
            Scrape
          </Button>
        </div>
        <p className="text-xs text-joy-gray-500">
          Supports: Amazon, AliExpress, eBay, and most e-commerce sites with Open Graph meta tags
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-joy-gray-900">Preview</h3>
            <span className="text-xs text-joy-gray-500">Source: {preview.source}</span>
          </div>

          <div className="bg-joy-gray-50 rounded-xl p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-joy-gray-500 mb-1">Title</label>
              <p className="font-medium text-joy-gray-900">{preview.title || '(No title found)'}</p>
            </div>

            {/* Price */}
            {preview.price && (
              <div>
                <label className="block text-xs font-medium text-joy-gray-500 mb-1">Price</label>
                <p className="font-medium text-joy-orange">
                  {preview.currency} {preview.price}
                </p>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-joy-gray-500 mb-1">Description</label>
              <p className="text-sm text-joy-gray-700 line-clamp-3">
                {preview.description || '(No description found)'}
              </p>
            </div>

            {/* Images */}
            {preview.images.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-joy-gray-500 mb-2">
                  Images ({preview.images.length})
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {preview.images.slice(0, 5).map((img, i) => (
                    <div key={i} className="w-20 h-20 rounded-lg bg-white overflow-hidden flex-shrink-0 border">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {preview.images.length > 5 && (
                    <div className="w-20 h-20 rounded-lg bg-joy-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-joy-gray-500">+{preview.images.length - 5}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              onClick={() => { setPreview(null); setUrl(''); }}
            >
              Try Another
            </Button>
            <Button 
              onClick={handleUseProduct}
              disabled={!preview.title && !preview.description}
            >
              <Icons.Check size={18} className="mr-2" />
              Use This Product
            </Button>
          </div>

          <p className="text-xs text-joy-gray-500">
            Note: Product will be added to draft. You can edit title, description, price, and images before saving.
            Translation from Chinese to English is not automatic - please edit the title and description as needed.
          </p>
        </div>
      )}

      {/* Cancel */}
      <div className="flex justify-end border-t pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

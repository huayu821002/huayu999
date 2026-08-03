'use client'

import { useState, useEffect } from 'react'
import { getLocaleFromHost } from './translate'

const CACHE_PREFIX = 'trans_'

interface UseProductTranslationOptions {
  name?: string | null
  description?: string | null
  shortDesc?: string | null
}

export function useProductTranslation(product: UseProductTranslationOptions, locale: string) {
  const [translated, setTranslated] = useState(product)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (locale === 'en') {
      setTranslated(product)
      return
    }

    const doTranslate = async () => {
      // Check cache first
      const cacheKey = `${CACHE_PREFIX}${locale}_${product.name}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          setTranslated(JSON.parse(cached))
          return
        } catch {}
      }

      setLoading(true)
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product, locale }),
        })
        const data = await res.json()
        if (data.success && data.data) {
          setTranslated(data.data)
          localStorage.setItem(cacheKey, JSON.stringify(data.data))
        }
      } catch (err) {
        console.error('Translation failed:', err)
      } finally {
        setLoading(false)
      }
    }

    if (product.name) {
      doTranslate()
    }
  }, [product.name, locale])

  return { translated, loading }
}

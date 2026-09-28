'use client'

import { useState, useEffect } from 'react'

interface UseProductTranslationOptions {
  name?: string | null
  description?: string | null
  shortDesc?: string | null
}

export function useProductTranslation(product: UseProductTranslationOptions, locale: string) {
  const [translated, setTranslated] = useState(product)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Only English is supported - no translation needed
    setTranslated(product)
    setLoading(false)
  }, [product.name, locale])

  return { translated, loading }
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Banner {
  id: string
  image: string
  link: string
  alt: string
  duration: number
}

export function HeroCarousel() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch('/api/banners')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setBanners(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch banners:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBanners()
  }, [fetchBanners])

  useEffect(() => {
    if (banners.length <= 1) return

    const duration = banners[currentIndex]?.duration || 5000
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, duration)

    return () => clearTimeout(timer)
  }, [banners, currentIndex])

  if (isLoading || banners.length === 0) {
    return null
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length)
  }

  const currentBanner = banners[currentIndex]

  return (
    <div className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden bg-joy-gray-100">
      {/* Slides */}
      {banners.map((banner, index) => (
        <Link
          key={banner.id}
          href={banner.link || '/'}
          className={`absolute inset-0 transition-opacity duration-500 ${
            index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
          onClick={(e) => {
            if (!banner.link) {
              e.preventDefault()
            }
          }}
        >
          <img
            src={banner.image}
            alt={banner.alt || `Banner ${index + 1}`}
            className="w-full h-full object-cover"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </Link>
      ))}

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-lg transition-colors"
            aria-label="Previous"
          >
            <svg className="w-5 h-5 text-joy-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-lg transition-colors"
            aria-label="Next"
          >
            <svg className="w-5 h-5 text-joy-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

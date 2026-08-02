'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface Banner {
  id: string
  image: string
  link: string
  alt: string
  duration: number
  title?: string
  subtitle?: string
  buttonText?: string
  buttonLink?: string
}

interface HeroCarouselProps {
  initialBanners?: Banner[]
}

export function HeroCarousel({ initialBanners }: HeroCarouselProps) {
  const [banners, setBanners] = useState<Banner[]>(initialBanners || [])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(!initialBanners)

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
    if (initialBanners) {
      setBanners(initialBanners)
      setIsLoading(false)
      return
    }
    fetchBanners()
  }, [initialBanners, fetchBanners])

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
    <div className="relative w-full h-64 sm:h-80 md:h-96 lg:h-[600px] overflow-hidden bg-joy-gray-900">
      {/* Slides */}
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-500 ${
            index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <img
            src={banner.image}
            alt={banner.alt || `Banner ${index + 1}`}
            className="w-full h-full object-cover"
          />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
          
          {/* Text Content */}
          <div className="absolute inset-0 z-20 flex items-center">
            <div className="max-w-7xl mx-auto px-4 w-full">
              <div className="max-w-2xl">
                {banner.title && (
                  <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 sm:mb-4 leading-tight">
                    {banner.title}
                  </h1>
                )}
                {banner.subtitle && (
                  <p className="text-sm sm:text-base md:text-lg text-white/90 mb-4 sm:mb-6 max-w-xl">
                    {banner.subtitle}
                  </p>
                )}
                {banner.buttonText && (
                  <Link href={banner.buttonLink || banner.link || '/'}>
                    <Button size="md" className="bg-joy-orange hover:bg-joy-orange/90 text-white border-0 text-sm sm:text-base">
                      {banner.buttonText}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg transition-colors"
            aria-label="Previous"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg transition-colors"
            aria-label="Next"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-8'
                  : 'bg-white/50 hover:bg-white/75 w-3'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { sanitizeHTML } from '@/lib/sanitize'

interface SiteContent {
  section: string
  title: string | null
  subtitle: string | null
  content: string | null
}

export default function AboutPage() {
  const [content, setContent] = useState<Record<string, SiteContent>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchContent()
  }, [])

  const fetchContent = async () => {
    try {
      const res = await fetch('/api/admin/site-content')
      const data = await res.json()
      if (data.success) {
        const contentMap: Record<string, SiteContent> = {}
        data.data.forEach((item: SiteContent) => { contentMap[item.section] = item })
        setContent(contentMap)
      }
    } catch (err) {
      console.error('Failed to fetch content:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const sc = (section: string) => content[section]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <CartDrawer />
      <FloatingButtons />
      <main className="pt-[calc(4rem+36px)]">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-joy-gray-900 via-joy-gray-800 to-joy-gray-900 text-white py-20 lg:py-28">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              {sc('about_hero')?.title || 'About Us'}
            </h1>
            <p className="text-xl text-joy-gray-300">
              {sc('about_hero')?.subtitle || 'Your trusted wholesale partner from Yiwu, China'}
            </p>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4">
            {/* About Content */}
            <div className="prose prose-lg max-w-none">
              {sc('about_content')?.content ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(sc('about_content')?.content || '') }} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-joy-gray-500 mb-4">
                    About page content is being updated. Please check back soon.
                  </p>
                  <p className="text-sm text-joy-gray-400">
                    Admin can edit this content in Settings → Site Content → about_content
                  </p>
                </div>
              )}
            </div>

            {/* Company Story */}
            {sc('about_story')?.title && (
              <div className="mt-16">
                <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-4">
                  {sc('about_story')!.title}
                </h2>
                <div className="prose max-w-none text-joy-gray-600">
                  {sc('about_story')?.content && (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(sc('about_story')?.content || '') }} />
                  )}
                </div>
              </div>
            )}

            {/* Values */}
            {sc('about_values')?.title && (
              <div className="mt-16">
                <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-8 text-center">
                  {sc('about_values')!.title}
                </h2>
                <div className="grid md:grid-cols-3 gap-8">
                  {sc('about_values')?.content && (() => {
                    try {
                      const values = JSON.parse(sc('about_values')!.content || '[]')
                      return values.map((value: any, i: number) => (
                        <div key={i} className="text-center">
                          <div className="w-16 h-16 rounded-2xl bg-joy-orange/10 flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">{value.icon || '✓'}</span>
                          </div>
                          <h3 className="font-semibold text-joy-gray-900 mb-2">{value.title}</h3>
                          <p className="text-sm text-joy-gray-600">{value.description}</p>
                        </div>
                      ))
                    } catch {
                      return null
                    }
                  })()}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-joy-gray-50 py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-4">
              {sc('about_cta')?.title || 'Ready to Source Products?'}
            </h2>
            <p className="text-joy-gray-600 mb-8">
              {sc('about_cta')?.subtitle || 'Start browsing our wholesale catalog or contact our team'}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/products" className="px-8 py-3 bg-joy-orange text-white rounded-xl font-semibold hover:bg-joy-orange/90 transition-colors">
                Browse Products
              </a>
              <a href="/contact" className="px-8 py-3 bg-white text-joy-gray-700 rounded-xl font-semibold hover:bg-joy-gray-50 transition-colors border-2 border-joy-gray-200">
                Contact Us
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

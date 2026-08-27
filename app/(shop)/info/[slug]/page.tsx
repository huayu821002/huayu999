'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import Image from 'next/image'
import { sanitizeHTML } from '@/lib/sanitize'

interface CustomPage {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  featuredImage: string | null
  template: string
  metaTitle: string | null
  metaDesc: string | null
}

const TEMPLATES = {
  default: 'max-w-4xl',
  'full-width': 'max-w-7xl',
  'sidebar': 'max-w-5xl',
  'landing': 'max-w-5xl',
}

export default function InfoPage() {
  const params = useParams()
  const [page, setPage] = useState<CustomPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPage()
  }, [params.slug])

  const fetchPage = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/pages/${params.slug}`)
      const data = await res.json()
      if (data.success) {
        setPage(data.data)
        // Update document title for SEO
        if (data.data.metaTitle) {
          document.title = data.data.metaTitle
        } else {
          document.title = `${data.data.title} - Fiestaflare`
        }
      } else {
        setError(data.error || 'Page not found')
      }
    } catch (err) {
      console.error('Failed to fetch page:', err)
      setError('Failed to load page')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-[calc(4rem+36px)]">
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <Icons.Package size={64} className="mx-auto mb-4 text-joy-gray-300" />
            <h1 className="text-2xl font-bold text-joy-gray-900 mb-2">Page Not Found</h1>
            <p className="text-joy-gray-500 mb-6">{error || 'The page you are looking for does not exist.'}</p>
            <Link href="/">
              <Button>Back to Home</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const containerClass = TEMPLATES[page.template as keyof typeof TEMPLATES] || TEMPLATES.default

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <CartDrawer />
      <FloatingButtons />
      <main className="pt-[calc(4rem+36px)]">
        {/* Featured Image */}
        {page.featuredImage && (
          <div className="relative h-64 md:h-80 lg:h-96 overflow-hidden">
            <Image 
              src={page.featuredImage} 
              alt={page.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-orange-900/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h1 className="font-display text-3xl md:text-4xl font-bold">{page.title}</h1>
              {page.excerpt && (
                <p className="text-lg text-white/80 mt-2 max-w-2xl">{page.excerpt}</p>
              )}
            </div>
          </div>
        )}

        {/* Hero (if no featured image) */}
        {!page.featuredImage && (
          <section className="bg-gradient-to-br from-orange-600 via-orange-500 to-orange-600 text-white py-16 lg:py-20">
            <div className={containerClass + ' mx-auto px-4 text-center'}>
              <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                {page.title}
              </h1>
              {page.excerpt && (
                <p className="text-xl text-joy-gray-300 max-w-2xl mx-auto">
                  {page.excerpt}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Breadcrumb */}
        <div className={containerClass + ' mx-auto px-4 py-4'}>
          <nav className="flex items-center gap-2 text-sm text-joy-gray-500">
            <Link href="/" className="hover:text-joy-orange">Home</Link>
            <Icons.ChevronRight size={14} />
            <span className="text-joy-gray-900">{page.title}</span>
          </nav>
        </div>

        {/* Content */}
        <section className={containerClass + ' mx-auto px-4 pb-16'}>
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content */}
            <div className={page.template === 'sidebar' ? 'lg:w-2/3' : 'w-full'}>
              <div 
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(page.content) }}
              />
            </div>

            {/* Sidebar (for sidebar template) */}
            {page.template === 'sidebar' && (
              <aside className="lg:w-1/3">
                <div className="bg-joy-gray-50 rounded-xl p-6 sticky top-24">
                  <h3 className="font-semibold text-joy-gray-900 mb-4">Quick Links</h3>
                  <div className="space-y-2">
                    <Link href="/shipping" className="block text-joy-orange hover:underline">Shipping Info</Link>
                    <Link href="/returns" className="block text-joy-orange hover:underline">Returns & Refunds</Link>
                    <Link href="/privacy" className="block text-joy-orange hover:underline">Privacy Policy</Link>
                    <Link href="/terms" className="block text-joy-orange hover:underline">Terms of Service</Link>
                  </div>
                  <div className="mt-6 pt-6 border-t border-joy-gray-200">
                    <h4 className="font-medium text-joy-gray-900 mb-2">Need Help?</h4>
                    <p className="text-sm text-joy-gray-600 mb-4">Our support team is here to help.</p>
                    <Link href="/contact">
                      <Button size="sm" className="w-full">Contact Us</Button>
                    </Link>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

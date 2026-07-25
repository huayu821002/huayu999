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

interface CustomPage {
  id: string
  title: string
  slug: string
  content: string
  metaTitle: string | null
  metaDesc: string | null
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

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <CartDrawer />
      <FloatingButtons />
      <main className="pt-[calc(4rem+36px)]">
        {/* SEO Meta Tags would go in Head component */}
        
        {/* Hero */}
        <section className="bg-gradient-to-br from-joy-gray-900 via-joy-gray-800 to-joy-gray-900 text-white py-16 lg:py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              {page.title}
            </h1>
            {page.metaDesc && (
              <p className="text-lg text-joy-gray-300 max-w-2xl mx-auto">
                {page.metaDesc}
              </p>
            )}
          </div>
        </section>

        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-joy-gray-500">
            <Link href="/" className="hover:text-joy-orange">Home</Link>
            <Icons.ChevronRight size={14} />
            <span className="text-joy-gray-900">{page.title}</span>
          </nav>
        </div>

        {/* Content */}
        <section className="py-8 pb-16">
          <div className="max-w-4xl mx-auto px-4">
            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

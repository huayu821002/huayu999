import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-joy-gray-100 flex items-center justify-center mx-auto mb-8">
            <Icons.Search size={48} className="text-joy-gray-300" />
          </div>
          <h1 className="font-display text-5xl font-bold text-joy-gray-900 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-joy-gray-700 mb-4">Page Not Found</h2>
          <p className="text-joy-gray-500 mb-8">
            Sorry, the page you are looking for does not exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button variant="secondary" size="lg">
                ←
                Back to Home
              </Button>
            </Link>
            <Link href="/products">
              <Button size="lg">
                Browse Products
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Icons } from '@/components/ui/Icons'

export default function AccountWishlistPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('user')
    if (!token) { router.push('/login'); return }
    setIsLoading(false)
  }, [router])

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" /></div>

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/account" className="p-2 hover:bg-joy-gray-100 rounded-lg"><Icons.ArrowLeft size={20} /></Link>
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">My Wishlist</h1>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Icons.Heart size={48} className="mx-auto text-joy-gray-300 mb-4" />
            <h2 className="font-semibold text-lg text-joy-gray-900 mb-2">Your Wishlist is Empty</h2>
            <p className="text-joy-gray-500 mb-6">Save items you like to your wishlist</p>
            <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-joy-orange text-white rounded-xl font-medium hover:bg-joy-orange/90 transition-colors">
              Browse Products <Icons.ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

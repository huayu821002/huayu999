'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'

interface User {
  id: string
  email: string
  name: string
  role: string
}

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/login')
      return
    }

    setUser(JSON.parse(userData))
    setIsLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-joy-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <CartDrawer />
      <FloatingButtons />

      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">
                My Account
              </h1>
              <p className="text-joy-gray-600">Welcome back, {user?.name}!</p>
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              <Icons.X size={18} className="mr-2" />
              Sign Out
            </Button>
          </div>

          {/* User Info */}
          <div className="bg-joy-gray-50 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-joy-orange to-joy-pink flex items-center justify-center text-white font-bold text-xl">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-lg text-joy-gray-900">{user?.name}</p>
                <p className="text-joy-gray-600">{user?.email}</p>
                <span className="inline-flex mt-1 px-3 py-1 bg-joy-orange/10 text-joy-orange text-xs font-medium rounded-full">
                  {user?.role === 'ADMIN' ? 'Administrator' : 'Customer'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Link href="/account/orders" className="bg-white border border-joy-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow">
              <Icons.Package size={32} className="text-joy-orange mb-3" />
              <h3 className="font-semibold text-joy-gray-900">My Orders</h3>
              <p className="text-sm text-joy-gray-500">Track and manage orders</p>
            </Link>
            <Link href="/account/wishlist" className="bg-white border border-joy-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow">
              <Icons.Heart size={32} className="text-joy-pink mb-3" />
              <h3 className="font-semibold text-joy-gray-900">Wishlist</h3>
              <p className="text-sm text-joy-gray-500">Your saved items</p>
            </Link>
            <Link href="/account/settings" className="bg-white border border-joy-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow">
              <Icons.User size={32} className="text-joy-green mb-3" />
              <h3 className="font-semibold text-joy-gray-900">Settings</h3>
              <p className="text-sm text-joy-gray-500">Update profile</p>
            </Link>
          </div>

          {/* Recent Orders Placeholder */}
          <div className="bg-white border border-joy-gray-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-lg text-joy-gray-900">Recent Orders</h2>
              <Link href="/account/orders" className="text-joy-orange text-sm hover:underline">
                View All
              </Link>
            </div>
            <div className="text-center py-8">
              <Icons.Package size={48} className="mx-auto text-joy-gray-300 mb-4" />
              <p className="text-joy-gray-600 mb-4">No orders yet</p>
              <Link href="/products">
                <Button>Start Shopping</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

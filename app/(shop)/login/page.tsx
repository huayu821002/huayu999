'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Mock login
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (email && password) {
      router.push('/account')
    } else {
      setError('Please enter your email and password')
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-joy-orange to-joy-pink flex items-center justify-center text-white font-display font-bold text-xl">
            JH
          </div>
          <div>
            <div className="font-display font-bold text-xl text-joy-gray-900">JoyHub</div>
            <div className="text-xs text-joy-gray-500">Wholesale</div>
          </div>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">Welcome Back</h1>
            <p className="text-joy-gray-600">Sign in to your account</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Icons.Mail size={18} />}
            />
            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Icons.Lock size={18} />}
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-joy-gray-300" />
                <span className="text-joy-gray-600">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-joy-orange hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              Sign In
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-joy-gray-200" />
            <span className="text-sm text-joy-gray-400">or continue with</span>
            <div className="flex-1 h-px bg-joy-gray-200" />
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 py-3 px-4 border-2 border-joy-gray-200 rounded-xl hover:border-joy-gray-300 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="font-medium text-sm">Google</span>
            </button>
            <button className="flex items-center justify-center gap-2 py-3 px-4 border-2 border-joy-gray-200 rounded-xl hover:border-joy-gray-300 transition-colors">
              <Icons.Facebook size={20} className="text-[#1877F2]" />
              <span className="font-medium text-sm">Facebook</span>
            </button>
          </div>
        </div>

        {/* Register Link */}
        <p className="text-center mt-6 text-joy-gray-600">
          Don't have an account?{' '}
          <Link href="/register" className="text-joy-orange font-semibold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

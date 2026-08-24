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
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          email,
          password,
          name,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Authentication failed')
        return
      }

      // Store token and user
      localStorage.setItem('token', data.data.token)
      localStorage.setItem('user', JSON.stringify(data.data.user))

      // Redirect based on role
      if (data.data.user.role === 'ADMIN') {
        router.push('/admin/dashboard')
      } else {
        router.push('/account')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-joy-orange to-joy-pink flex items-center justify-center text-white font-display font-bold text-xl">
            FF
          </div>
          <div>
            <div className="font-display font-bold text-xl text-joy-gray-900">Fiestaflare</div>
            <div className="text-xs text-joy-gray-500">Wholesaler</div>
          </div>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-joy-gray-600">
              {mode === 'login' ? 'Sign in to your account' : 'Start your wholesale journey'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex rounded-xl bg-joy-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white shadow text-joy-gray-900' : 'text-joy-gray-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'register' ? 'bg-white shadow text-joy-gray-900' : 'text-joy-gray-600'
              }`}
            >
              Register
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <Input
                type="text"
                label="Full Name"
                placeholder="John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={<Icons.User size={18} />}
              />
            )}
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

            {mode === 'login' && (
              <div className="flex items-center justify-end text-sm">
                <Link href="/forgot-password" className="text-joy-orange hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>


        </div>

        {/* Register Link */}
        {mode === 'login' && (
          <p className="text-center mt-6 text-joy-gray-600">
            Don't have an account?{' '}
            <button onClick={() => setMode('register')} className="text-joy-orange font-semibold hover:underline">
              Create one
            </button>
          </p>
        )}

        {/* Back to Store */}
        <p className="text-center mt-4">
          <Link href="/" className="text-sm text-joy-gray-500 hover:text-joy-orange">
            ← Back to Store
          </Link>
        </p>
      </div>
    </div>
  )
}

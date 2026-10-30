'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { adminFetch } from '@/lib/adminFetch'

interface AccountInfo {
  id: string
  email: string
  name: string | null
  role: string
}

export default function AdminAccountPage() {
  const [info, setInfo] = useState<AccountInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 改邮箱
  const [currentPw, setCurrentPw] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)

  // 改密码
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await adminFetch('/api/admin/account')
        const j = await res.json()
        if (j.success) {
          setInfo(j.data)
          setNewEmail(j.data.email)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setEmailBusy(true)
    try {
      const res = await adminFetch('/api/admin/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newEmail }),
      })
      const j = await res.json()
      if (j.success) {
        setInfo(j.data)
        setCurrentPw('')
        setMsg({ type: 'ok', text: 'Email updated. Use the new email to sign in from now on.' })
      } else {
        setMsg({ type: 'err', text: j.error || 'Failed to update email' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error' })
    } finally {
      setEmailBusy(false)
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (newPw !== confirmPw) {
      setMsg({ type: 'err', text: 'New passwords do not match' })
      return
    }
    setPwBusy(true)
    try {
      const res = await adminFetch('/api/admin/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: oldPw, newPassword: newPw }),
      })
      const j = await res.json()
      if (j.success) {
        setOldPw('')
        setNewPw('')
        setConfirmPw('')
        setMsg({ type: 'ok', text: 'Password updated.' })
      } else {
        setMsg({ type: 'err', text: j.error || 'Failed to update password' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error' })
    } finally {
      setPwBusy(false)
    }
  }

  const card = 'bg-white rounded-2xl shadow-sm border border-joy-gray-100 p-6 max-w-xl'
  const label = 'block text-sm font-medium text-joy-gray-700 mb-2'
  const input =
    'w-full px-4 py-3 rounded-xl border-2 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 border-joy-gray-200 focus:border-joy-orange focus:ring-joy-orange/20 placeholder:text-joy-gray-400'

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-joy-gray-900 mb-1">Account Security</h1>
        <p className="text-sm text-joy-gray-500 mb-8">
          Change the sign-in email or password for this admin account.
        </p>

        {msg && (
          <div
            className={`mb-6 px-4 py-3 rounded-xl text-sm ${
              msg.type === 'ok'
                ? 'bg-joy-green/10 text-joy-green border border-joy-green/30'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="space-y-6">
          <section className={card}>
            <h2 className="text-lg font-semibold text-joy-gray-900 mb-4">Sign-in email</h2>
            <p className="text-sm text-joy-gray-500 mb-4">
              Current: <span className="font-mono">{loading ? '…' : info?.email}</span>
            </p>
            <form onSubmit={submitEmail} className="space-y-4">
              <div>
                <label className={label}>New email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={input}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className={label}>Current password (confirm)</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className={input}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={emailBusy}>
                {emailBusy ? 'Saving…' : 'Update email'}
              </Button>
            </form>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-joy-gray-900 mb-4">Password</h2>
            <p className="text-sm text-joy-gray-500 mb-4">
              At least 8 characters, including letters and numbers.
            </p>
            <form onSubmit={submitPassword} className="space-y-4">
              <div>
                <label className={label}>Current password</label>
                <input
                  type="password"
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                  className={input}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className={label}>New password</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className={input}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className={label}>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className={input}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={pwBusy}>
                {pwBusy ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

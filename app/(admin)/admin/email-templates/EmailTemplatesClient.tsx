'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/components/ui/Icons'
import { adminFetch } from '@/lib/adminFetch'

interface EmailTemplate {
  key: string
  subject: string
  body: string
  enabled: boolean
}

const TEMPLATE_META: Record<string, { label: string; description: string; variables: string[] }> = {
  welcome: {
    label: 'Welcome Email',
    description: 'Sent when a new customer registers',
    variables: ['customer_name', 'store_name', 'login_url'],
  },
  order_confirm: {
    label: 'Order Confirmation',
    description: 'Sent after order is placed',
    variables: ['customer_name', 'order_number', 'order_date', 'order_total', 'order_items'],
  },
  order_shipped: {
    label: 'Order Shipped',
    description: 'Sent when order ships',
    variables: ['customer_name', 'order_number', 'tracking_number', 'carrier', 'tracking_url'],
  },
  order_delivered: {
    label: 'Order Delivered',
    description: 'Sent when order is delivered',
    variables: ['customer_name', 'order_number'],
  },
  password_reset: {
    label: 'Password Reset',
    description: 'Sent when user requests password reset',
    variables: ['customer_name', 'reset_link', 'store_name'],
  },
}

export function EmailTemplatesClient({ initialTemplates }: { initialTemplates: Record<string, EmailTemplate> }) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>(initialTemplates)
  const [activeTemplate, setActiveTemplate] = useState<string>('welcome')
  const [editForm, setEditForm] = useState<EmailTemplate>(initialTemplates['welcome'] || { key: 'welcome', subject: '', body: '', enabled: true })
  const [isSaving, setIsSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [showTestModal, setShowTestModal] = useState(false)

  // Sync editForm when switching templates
  useEffect(() => {
    const t = templates[activeTemplate]
    if (t) setEditForm(t)
  }, [activeTemplate, templates])

  const saveTemplate = async () => {
    setIsSaving(true)
    try {
      const res = await adminFetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: activeTemplate,
          subject: editForm.subject,
          body: editForm.body,
          enabled: editForm.enabled,
        }),
      })
      const data = await res.json()
      if (data.success) {
        alert('Template saved!')
        // Refresh from server
        const refreshed = await adminFetch('/api/admin/email-templates')
        const refreshedData = await refreshed.json()
        if (refreshedData.success) setTemplates(refreshedData.data)
      } else {
        alert('Failed: ' + data.error)
      }
    } catch { alert('Failed to save') }
    setIsSaving(false)
  }

  const sendTestEmail = async () => {
    if (!testEmail) { alert('Enter a test email'); return }
    setIsSaving(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: activeTemplate,
          to: { email: testEmail },
          variables: {
            customer_name: 'John Doe',
            order_number: 'JH-TEST-001',
            order_date: new Date().toLocaleDateString(),
            order_total: '$99.99',
            tracking_number: '1Z999AA10123456784',
            carrier: 'UPS',
            reset_link: 'https://fiestaflare.com/reset-password?token=test',
            login_url: 'https://fiestaflare.com/login',
          },
        }),
      })
      const data = await res.json()
      if (data.success) { alert('Test email sent!'); setShowTestModal(false); setTestEmail('') }
      else alert('Failed: ' + data.error)
    } catch { alert('Failed to send test email') }
    setIsSaving(false)
  }

  const meta = TEMPLATE_META[activeTemplate] || { label: activeTemplate, description: '', variables: [] }

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Title */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-joy-gray-900">Email Templates</h1>
              <p className="text-joy-gray-500 mt-1">Manage transactional email templates</p>
            </div>
            <Link href="/admin/dashboard">
              <Button variant="secondary">Back to Dashboard</Button>
            </Link>
          </div>

          {/* Setup Info Banner */}
          <div className="bg-joy-orange/10 border border-joy-orange/30 rounded-2xl p-5 mb-8">
            <div className="flex items-start gap-3">
              <Icons.Mail size={20} className="text-joy-orange mt-0.5" />
              <div>
                <h3 className="font-semibold text-joy-gray-900">Email Provider Setup</h3>
                <p className="text-sm text-joy-gray-600 mt-1">
                  Add one API key to your environment variables:<br />
                  <code className="bg-joy-orange/20 px-1.5 py-0.5 rounded text-joy-orange font-mono text-xs">RESEND_API_KEY</code>
                  {' — '}<a href="https://resend.com" target="_blank" className="text-joy-orange underline font-medium">Resend</a> ⭐ Easiest<br />
                  <code className="bg-joy-orange/20 px-1.5 py-0.5 rounded text-joy-orange font-mono text-xs">SENDGRID_API_KEY</code>
                  {' — '}<a href="https://app.sendgrid.com" target="_blank" className="text-joy-orange underline">SendGrid</a><br />
                  <code className="bg-joy-orange/20 px-1.5 py-0.5 rounded text-joy-orange font-mono text-xs">BREVO_API_KEY</code>
                  {' — '}<a href="https://app.brevo.com" target="_blank" className="text-joy-orange underline">Brevo</a>
                  <br /><span className="text-xs text-joy-gray-500">Without an API key, emails are logged to console only. All support custom HTML.</span>
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex gap-6 min-h-[600px]">

            {/* Sidebar */}
            <div className="w-72 flex-shrink-0">
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h2 className="font-semibold text-joy-gray-900 px-2 mb-3">Templates</h2>
                <div className="space-y-1">
                  {Object.entries(TEMPLATE_META).map(([key, m]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTemplate(key)}
                      className={`w-full text-left px-3 py-3 rounded-xl transition-colors ${
                        activeTemplate === key
                          ? 'bg-joy-orange text-white'
                          : 'hover:bg-joy-gray-100 text-joy-gray-700'
                      }`}
                    >
                      <div className={`font-medium text-sm ${activeTemplate === key ? 'text-white' : 'text-joy-gray-900'}`}>
                        {m.label}
                      </div>
                      <div className={`text-xs mt-0.5 ${activeTemplate === key ? 'text-white/80' : 'text-joy-gray-400'}`}>
                        {m.description}
                      </div>
                      {templates[key] && !templates[key].enabled && activeTemplate !== key && (
                        <span className="inline-block mt-1 text-xs px-1.5 py-0.5 bg-joy-gray-200 text-joy-gray-500 rounded">Disabled</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-lg text-joy-gray-900">{meta.label}</h2>
                  <p className="text-sm text-joy-gray-500 mt-0.5">{meta.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-joy-gray-600">Enabled</span>
                    <button
                      onClick={() => setEditForm(f => ({ ...f, enabled: !f.enabled }))}
                      className={`w-12 h-6 rounded-full transition-colors ${editForm.enabled ? 'bg-joy-orange' : 'bg-joy-gray-300'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${editForm.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  <Button variant="secondary" onClick={() => setShowTestModal(true)}>
                    <Icons.Mail size={16} className="mr-2" />Test
                  </Button>
                  <Button onClick={saveTemplate} isLoading={isSaving}>Save</Button>
                </div>
              </div>

              {/* Subject */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">Subject Line</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange text-sm"
                  placeholder="Email subject"
                  value={editForm.subject}
                  onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))}
                />
              </div>

              {/* Variables */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">Available Variables (click to insert)</label>
                <div className="flex flex-wrap gap-2">
                  {meta.variables.map((v) => (
                    <code
                      key={v}
                      className="px-2 py-1 bg-joy-gray-100 text-joy-orange font-mono text-xs rounded cursor-pointer hover:bg-joy-orange/10"
                      onClick={() => setEditForm(f => ({ ...f, body: f.body + `{{${v}}}` }))}
                    >
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              </div>

              {/* HTML Body */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">Email Body (HTML)</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange text-sm font-mono"
                  rows={18}
                  placeholder="<h1>Hello {{customer_name}}</h1>..."
                  value={editForm.body}
                  onChange={(e) => setEditForm(f => ({ ...f, body: e.target.value }))}
                />
              </div>

              {/* Preview */}
              {editForm.body && (
                <div>
                  <label className="block text-sm font-medium text-joy-gray-700 mb-2">Preview</label>
                  <div
                    className="border border-joy-gray-200 rounded-xl p-4 bg-gray-50 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{
                      __html: editForm.body
                        .replace(/\{\{customer_name\}\}/g, 'John Doe')
                        .replace(/\{\{store_name\}\}/g, 'Fiestaflare')
                        .replace(/\{\{order_number\}\}/g, 'JH-TEST-001')
                        .replace(/\{\{order_date\}\}/g, new Date().toLocaleDateString())
                        .replace(/\{\{order_total\}\}/g, '$99.99')
                        .replace(/\{\{login_url\}\}/g, '#'),
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTestModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-joy-gray-100 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-joy-gray-900">Send Test Email</h2>
              <button onClick={() => setShowTestModal(false)} className="p-2 hover:bg-joy-gray-100 rounded-lg">
                <Icons.X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-joy-gray-600 mb-4">
                Send a test email for <strong>{meta.label}</strong> template.
              </p>
              <Input
                label="Recipient Email"
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <div className="px-6 py-4 border-t border-joy-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowTestModal(false)}>Cancel</Button>
              <Button onClick={sendTestEmail} isLoading={isSaving}>Send Test</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

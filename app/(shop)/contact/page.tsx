'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { sanitizeHTML } from '@/lib/sanitize'

interface SiteContent {
  section: string
  title: string | null
  subtitle: string | null
  content: string | null
}

interface ContactInfo {
  email?: string
  whatsapp?: string
  phone?: string
  address?: string
  hours?: string
}

export default function ContactPage() {
  const [content, setContent] = useState<Record<string, SiteContent>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

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

  const getContactInfo = (): ContactInfo => {
    try {
      if (sc('contact_info')?.content) {
        return JSON.parse(sc('contact_info')!.content!)
      }
    } catch {}
    return {
      email: 'sales@fiestaflare.com',
      whatsapp: '+86 158 5791 1234',
      hours: 'Mon-Fri 9:00-18:00 CST',
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate form submission (in production, this would call an API)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setSubmitSuccess(true)
    setFormData({ name: '', email: '', company: '', message: '' })
    setIsSubmitting(false)
    
    setTimeout(() => setSubmitSuccess(false), 5000)
  }

  const contactInfo = getContactInfo()

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
              {sc('contact_hero')?.title || 'Contact Us'}
            </h1>
            <p className="text-xl text-joy-gray-300">
              {sc('contact_hero')?.subtitle || 'We are here to help with your wholesale inquiries'}
            </p>
          </div>
        </section>

        {/* Contact Content */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Contact Form */}
              <div>
                <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-6">
                  {sc('contact_form')?.title || 'Send us a Message'}
                </h2>
                
                {submitSuccess && (
                  <div className="mb-6 p-4 bg-joy-green/10 border border-joy-green/20 rounded-xl text-joy-green">
                    Thank you for your message! We will get back to you within 24 hours.
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
                        placeholder="john@company.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-2">
                        Company
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({...formData, company: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none"
                        placeholder="Your Company Ltd."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">
                      Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none resize-none"
                      placeholder="Tell us about your business and what products you are interested in..."
                    />
                  </div>
                  <Button type="submit" size="xl" isLoading={isSubmitting} className="w-full">
                    Send Message
                  </Button>
                </form>
              </div>

              {/* Contact Info */}
              <div>
                <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-6">
                  {sc('contact_info')?.title || 'Get in Touch'}
                </h2>
                
                <div className="space-y-6">
                  {contactInfo.email && (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-joy-orange/10 flex items-center justify-center flex-shrink-0">
                        <Icons.Mail size={20} className="text-joy-orange" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-joy-gray-900">Email</h3>
                        <a href={`mailto:${contactInfo.email}`} className="text-joy-orange hover:underline">
                          {contactInfo.email}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {contactInfo.whatsapp && (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                        <Icons.WhatsApp size={20} className="text-green-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-joy-gray-900">WhatsApp</h3>
                        <a 
                          href={`https://wa.me/${contactInfo.whatsapp.replace(/[^0-9]/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-joy-orange hover:underline"
                        >
                          {contactInfo.whatsapp}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {contactInfo.phone && (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Icons.Phone size={20} className="text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-joy-gray-900">Phone</h3>
                        <a href={`tel:${contactInfo.phone}`} className="text-joy-orange hover:underline">
                          {contactInfo.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {contactInfo.address && (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <Icons.MapPin size={20} className="text-purple-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-joy-gray-900">Address</h3>
                        <p className="text-joy-gray-600">{contactInfo.address}</p>
                      </div>
                    </div>
                  )}
                  
                  {contactInfo.hours && (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-joy-navy/10 flex items-center justify-center flex-shrink-0">
                        <Icons.Package size={20} className="text-joy-navy" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-joy-gray-900">Business Hours</h3>
                        <p className="text-joy-gray-600">{contactInfo.hours}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom HTML Content */}
                {sc('contact_extra')?.content && (
                  <div className="mt-8 pt-8 border-t border-joy-gray-100">
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(sc('contact_extra')!.content!) }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

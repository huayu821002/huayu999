'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'
import { TRUST_BADGES } from '@/types'

const defaultFooterSettings = {
  logo: { text: 'Fiestaflare', image: '' },
  columns: [
    {
      title: "Products",
      links: [
        { href: "/products?category=accessories", label: "Accessories & Jewelry" },
        { href: "/products?category=pet-supplies", label: "Pet Supplies" },
        { href: "/products?category=gifts", label: "Creative Gifts" },
        { href: "/products?category=home-decor", label: "Home Décor" }
      ]
    },
    {
      title: "Company",
      links: [
        { href: "/info/about-us", label: "About Us" },
        { href: "/info/contact", label: "Contact Us" },
        { href: "/info/faq", label: "FAQ" }
      ]
    },
    {
      title: "Wholesale",
      links: [
        { href: "/info/shipping", label: "Shipping Info" },
        { href: "/info/returns", label: "Returns & Refunds" },
        { href: "/info/terms", label: "Terms of Service" }
      ]
    },
    {
      title: "Account",
      links: [
        { href: "/login", label: "Sign In" },
        { href: "/register", label: "Create Account" },
        { href: "/account", label: "My Account" }
      ]
    }
  ],
  copyright: "© 2024 Fiestaflare. All rights reserved.",
  contact: {
    email: "sales@fiestaflare.com",
    phone: ""
  }
}

const SOCIAL_LINKS = [
  { href: 'https://instagram.com', icon: Icons.Instagram, label: 'Instagram' },
  { href: 'https://facebook.com', icon: Icons.Facebook, label: 'Facebook' },
  { href: 'https://twitter.com', icon: Icons.Twitter, label: 'Twitter' },
  { href: 'https://youtube.com', icon: Icons.Youtube, label: 'YouTube' },
  { href: 'https://tiktok.com', icon: Icons.TikTok, label: 'TikTok' },
]

export function Footer() {
  const [footerSettings, setFooterSettings] = useState(defaultFooterSettings)

  useEffect(() => {
    const fetchFooterSettings = async () => {
      try {
        const res = await fetch('/api/site/header-footer')
        const data = await res.json()
        if (data.success && data.data.footer) {
          setFooterSettings(data.data.footer)
        }
      } catch (err) {
        console.error('Failed to fetch footer settings:', err)
      }
    }
    fetchFooterSettings()
  }, [])

  const columns = footerSettings.columns || defaultFooterSettings.columns

  return (
    <footer className="bg-joy-gray-900 text-white">
      {/* Trust Badges Banner */}
      <div className="bg-gradient-to-r from-joy-orange via-joy-pink to-joy-green">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-8">
            {TRUST_BADGES.map((badge) => (
              <div key={badge.text} className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  {badge.icon === 'Truck' && <Icons.Truck size={20} />}
                  {badge.icon === 'RefreshCw' && <Icons.RefreshCw size={20} />}
                  {badge.icon === 'ShieldCheck' && <Icons.ShieldCheck size={20} />}
                  {badge.icon === 'MessageCircle' && <Icons.MessageCircle size={20} />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{badge.text}</div>
                  <div className="text-xs text-white/80">{badge.subtext}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Logo & About */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-joy-orange to-joy-pink flex items-center justify-center text-white font-display font-bold text-xl">
                F
              </div>
              <div className="font-display font-bold text-xl text-white">
                Fiestaflare
              </div>
            </Link>
            <p className="text-sm text-joy-gray-400 mb-4">
              Your trusted wholesale partner for unique products.
            </p>
            {/* Social Links */}
            <div className="flex gap-3">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-joy-gray-800 flex items-center justify-center hover:bg-joy-orange transition-colors"
                  aria-label={social.label}
                >
                  <social.icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Footer Columns */}
          {columns.map((column: any, idx: number) => (
            <div key={idx}>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-white mb-4">
                {column.title}
              </h3>
              <ul className="space-y-2.5">
                {column.links?.map((link: any, linkIdx: number) => (
                  <li key={linkIdx}>
                    <Link
                      href={link.href}
                      className="text-sm text-joy-gray-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-joy-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div 
              className="text-sm text-joy-gray-400 text-center md:text-left"
              dangerouslySetInnerHTML={{ __html: footerSettings.copyright || defaultFooterSettings.copyright }}
            />
            {(footerSettings.contact?.email || footerSettings.contact?.phone) && (
              <div className="flex items-center gap-4 text-sm text-joy-gray-400">
                {footerSettings.contact?.email && (
                  <a href={`mailto:${footerSettings.contact.email}`} className="hover:text-white flex items-center gap-1">
                    <Icons.Mail size={14} />
                    {footerSettings.contact.email}
                  </a>
                )}
                {footerSettings.contact?.phone && (
                  <a href={`tel:${footerSettings.contact.phone}`} className="hover:text-white flex items-center gap-1">
                    <Icons.Phone size={14} />
                    {footerSettings.contact.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}

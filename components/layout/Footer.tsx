import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'
import { TRUST_BADGES } from '@/types'

const FOOTER_LINKS = {
  products: [
    { href: '/products?category=accessories', label: 'Accessories & Jewelry' },
    { href: '/products?category=pet-supplies', label: 'Pet Supplies' },
    { href: '/products?category=gifts', label: 'Creative Gifts' },
    { href: '/products?category=home-decor', label: 'Home Décor' },
    { href: '/products?collection=trending-now', label: '🔥 Trending Now' },
  ],
  company: [
    { href: '/about', label: 'About JoyHub' },
    { href: '/contact', label: 'Contact Us' },
    { href: '/faq', label: 'FAQ' },
    { href: '/blog', label: 'Blog' },
  ],
  wholesale: [
    { href: '/how-to-order', label: 'How to Order' },
    { href: '/shipping', label: 'Shipping Info' },
    { href: '/returns', label: 'Returns & Refunds' },
    { href: '/compliance', label: 'Safety & Compliance' },
    { href: '/dropshipping', label: 'Dropshipping' },
  ],
  account: [
    { href: '/login', label: 'Sign In' },
    { href: '/register', label: 'Create Account' },
    { href: '/account', label: 'My Account' },
    { href: '/account/orders', label: 'Order Tracking' },
    { href: '/account/wishlist', label: 'Wishlist' },
  ],
}

const SOCIAL_LINKS = [
  { href: 'https://instagram.com', icon: Icons.Instagram, label: 'Instagram' },
  { href: 'https://facebook.com', icon: Icons.Facebook, label: 'Facebook' },
  { href: 'https://twitter.com', icon: Icons.Twitter, label: 'Twitter' },
  { href: 'https://youtube.com', icon: Icons.Youtube, label: 'YouTube' },
  { href: 'https://tiktok.com', icon: Icons.TikTok, label: 'TikTok' },
]

export function Footer() {
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
      <div className="max-w-7xl mx-auto px-4 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-joy-orange to-joy-pink flex items-center justify-center text-white font-display font-bold text-xl">
                JH
              </div>
              <div>
                <div className="font-display font-bold text-xl">JoyHub</div>
                <div className="text-xs text-joy-gray-400">Wholesale</div>
              </div>
            </Link>
            <p className="text-joy-gray-400 text-sm mb-4">
              Your trusted B2B partner for high-quality accessories, pet supplies, and creative gifts from Yiwu, China.
            </p>
            <div className="flex items-center gap-2">
              <Icons.Mail size={18} className="text-joy-gray-400" />
              <a href="mailto:hello@joyhubwholesale.com" className="text-sm text-joy-gray-300 hover:text-white transition-colors">
                hello@joyhubwholesale.com
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="font-semibold text-white mb-4">Products</h3>
            <ul className="space-y-2">
              {FOOTER_LINKS.products.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-joy-gray-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-2">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-joy-gray-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Wholesale */}
          <div>
            <h3 className="font-semibold text-white mb-4">Wholesale</h3>
            <ul className="space-y-2">
              {FOOTER_LINKS.wholesale.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-joy-gray-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold text-white mb-4">Account</h3>
            <ul className="space-y-2">
              {FOOTER_LINKS.account.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-joy-gray-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-joy-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-joy-gray-400 text-sm">
              © {new Date().getFullYear()} JoyHub Wholesale. All rights reserved.
            </div>

            {/* Payment Methods */}
            <div className="flex items-center gap-4">
              <span className="text-joy-gray-500 text-xs">We accept:</span>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-joy-gray-800 rounded text-xs font-medium">Visa</div>
                <div className="px-3 py-1.5 bg-joy-gray-800 rounded text-xs font-medium">Mastercard</div>
                <div className="px-3 py-1.5 bg-joy-gray-800 rounded text-xs font-medium">PayPal</div>
                <div className="px-3 py-1.5 bg-joy-gray-800 rounded text-xs font-medium">Stripe</div>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-joy-gray-800 flex items-center justify-center text-joy-gray-400 hover:bg-joy-orange hover:text-white transition-all"
                  aria-label={social.label}
                >
                  <social.icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Legal Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-joy-gray-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <span>|</span>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <span>|</span>
            <Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

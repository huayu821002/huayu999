import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET header and footer settings
export async function GET() {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ['header_settings', 'footer_settings'] } }
    })
    
    const result: any = {}
    for (const s of settings) {
      if (s.key === 'header_settings') {
        result.header = s.value ? JSON.parse(s.value) : getDefaultHeader()
      } else if (s.key === 'footer_settings') {
        result.footer = s.value ? JSON.parse(s.value) : getDefaultFooter()
      }
    }
    
    if (!result.header) result.header = getDefaultHeader()
    if (!result.footer) result.footer = getDefaultFooter()
    
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json({ success: true, data: { header: getDefaultHeader(), footer: getDefaultFooter() } })
  }
}

// POST update header and footer settings (using POST instead of PUT to avoid 405 on Vercel)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { header, footer } = body
    
    if (header) {
      await prisma.siteSetting.upsert({
        where: { key: 'header_settings' },
        update: { value: JSON.stringify(header) },
        create: { key: 'header_settings', value: JSON.stringify(header) }
      })
    }
    
    if (footer) {
      await prisma.siteSetting.upsert({
        where: { key: 'footer_settings' },
        update: { value: JSON.stringify(footer) },
        create: { key: 'footer_settings', value: JSON.stringify(footer) }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

function getDefaultHeader() {
  return {
    promoBanner: {
      enabled: true,
      text: "🎉 $50 Minimum Mixed Order | Free Shipping NA $299+ | SA $499+ 🚚 15-20 Days Worldwide"
    },
    logo: {
      type: "text",
      text: "Fiestaflare",
      image: ""
    },
    navLinks: [
      { href: "/", label: "Home" },
      { href: "/products", label: "Products" },
      { href: "/products?collection=trending-now", label: "🔥 Trending" },
      { href: "/products?collection=pet-me", label: "🐾 Pet & Me" },
      { href: "/info/about-us", label: "About" },
      { href: "/info/contact", label: "Contact" }
    ]
  }
}

function getDefaultFooter() {
  return {
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
}

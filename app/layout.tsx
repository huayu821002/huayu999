import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from '@/components/Providers'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'Fiestaflare Wholesaler | Yiwu Accessories, Pet Supplies & Creative Gifts',
  description: 'B2B small wholesale platform for high-quality accessories, pet trending supplies, creative novelty gifts, and Nordic/Ins-style home décor. $50 minimum mixed order. Ships to North & South America.',
  keywords: ['wholesale', 'Yiwu accessories', 'pet supplies', 'novelty gifts', 'B2B', 'small wholesale', 'cross-border e-commerce'],
  authors: [{ name: 'Fiestaflare' }],
  openGraph: {
    title: 'Fiestaflare Wholesaler | B2B Small Wholesale Platform',
    description: 'High-quality accessories, pet supplies & creative gifts. $50 minimum mixed order. Ships worldwide.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fiestaflare Wholesaler',
    description: 'B2B small wholesale for trending accessories, pet supplies & gifts.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FF6B35',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen bg-joy-gray-50 antialiased">
        <Providers>
          {children}
          <Toaster 
            position="top-center" 
            toastOptions={{
              style: {
                background: 'white',
                color: '#212121',
                borderRadius: '1rem',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}

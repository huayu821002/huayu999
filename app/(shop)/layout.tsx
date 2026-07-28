import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Huayu Wholesale | B2B Cross-border E-commerce Platform',
    template: '%s | Huayu Wholesale',
  },
  description: 'B2B small wholesale platform for high-quality accessories, pet supplies, creative novelty gifts, and home décor. $50 minimum mixed order. Ships worldwide.',
  keywords: ['wholesale', 'Yiwu accessories', 'pet supplies', 'novelty gifts', 'B2B', 'small wholesale', 'cross-border e-commerce'],
  authors: [{ name: 'Huayu' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Huayu Wholesale',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

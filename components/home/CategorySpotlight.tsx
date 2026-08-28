'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'

const spotlights = [
  {
    title: 'Amazon Sellers Zone',
    subtitle: 'Products ready for Amazon FBA',
    icon: 'TrendingUp',
    href: '/products?collection=trending',
    image: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5ad2?w=600',
    tag: '🔥 Hot',
  },
  {
    title: 'Pet Lovers Collection',
    subtitle: 'Bestselling pet supplies & accessories',
    icon: 'Heart',
    href: '/categories/Pet-Supplies',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600',
    tag: '🐾 Popular',
  },
  {
    title: 'Party & Events',
    subtitle: 'Wholesale party supplies for all occasions',
    icon: 'Sparkles',
    href: '/categories/Party-Supplies',
    image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600',
    tag: '🎉 New',
  },
]

export function CategorySpotlight() {
  return (
    <section className="py-16 bg-joy-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-2xl font-bold text-joy-gray-900">
              Shop by Collection
            </h2>
            <p className="text-joy-gray-500 mt-1">
              Curated selections for every business need
            </p>
          </div>
          <Link href="/products">
            <Button variant="secondary" size="sm">
              View All <Icons.ChevronRight size={16} className="ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {spotlights.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group relative rounded-2xl overflow-hidden aspect-[4/3] block"
            >
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute top-3 left-3">
                <span className="bg-white/90 text-joy-gray-900 text-xs font-bold px-2.5 py-1 rounded-full">
                  {item.tag}
                </span>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 mb-1">
                  {item.icon === 'TrendingUp' && <Icons.TrendUp size={18} className="text-white" />}
                  {item.icon === 'Heart' && <Icons.Heart size={18} className="text-white" />}
                  {item.icon === 'Sparkles' && <Icons.Sparkles size={18} className="text-white" />}
                </div>
                <h3 className="font-bold text-xl text-white mb-1">{item.title}</h3>
                <p className="text-white/80 text-sm">{item.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

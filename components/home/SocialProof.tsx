'use client'

import { Icons } from '@/components/ui/Icons'

const stats = [
  { value: '500+', label: 'Global Wholesalers' },
  { value: '150+', label: 'Countries Served' },
  { value: '15-20', label: 'Days Delivery' },
  { value: '98%', label: 'Client Satisfaction' },
]

const testimonials = [
  {
    quote: 'Great quality products and fast shipping. Will order again!',
    author: 'Maria S.',
    company: 'Boutique Owner, Brazil',
    rating: 5,
  },
  {
    quote: 'Best wholesale prices for pet supplies. Highly recommend!',
    author: 'John D.',
    company: 'Pet Store Chain, USA',
    rating: 5,
  },
  {
    quote: 'Excellent customer service and quality control.',
    author: 'Ana M.',
    company: 'Online Retailer, Mexico',
    rating: 5,
  },
]

export function SocialProof() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-4xl font-bold text-joy-orange mb-1">
                {stat.value}
              </div>
              <p className="text-sm text-joy-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">
            What Our Clients Say
          </h2>
          <p className="text-joy-gray-500">Trusted by wholesalers worldwide</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-joy-gray-50 rounded-2xl p-6">
              <div className="flex gap-1 mb-3">
                {[...Array(t.rating)].map((_, idx) => (
                  <Icons.Star key={idx} size={16} className="text-joy-orange fill-joy-orange" />
                ))}
              </div>
              <p className="text-joy-gray-700 mb-4 italic">&quot;{t.quote}&quot;</p>
              <div>
                <p className="font-semibold text-sm text-joy-gray-900">{t.author}</p>
                <p className="text-xs text-joy-gray-500">{t.company}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

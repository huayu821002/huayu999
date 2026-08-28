'use client'

import { Icons } from '@/components/ui/Icons'

const reasons = [
  {
    icon: 'Factory',
    title: 'Factory Direct',
    desc: 'Competitive prices with no middleman markup',
  },
  {
    icon: 'Globe',
    title: 'Global Shipping',
    desc: '150+ countries, 15-20 days worldwide delivery',
  },
  {
    icon: 'ShieldCheck',
    title: 'Quality Inspection',
    desc: 'Every product inspected before shipping',
  },
  {
    icon: 'Package',
    title: 'Low MOQ',
    desc: 'Order from just 3 units, mix & match freely',
  },
  {
    icon: 'Headphones',
    title: '24/7 Support',
    desc: 'Professional team ready to assist you',
  },
  {
    icon: 'Edit3',
    title: 'Customization',
    desc: 'Logo, packaging & brand customization available',
  },
]

export function WhyChooseUs() {
  return (
    <section className="py-16 bg-gradient-to-br from-orange-50 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold text-joy-gray-900 mb-3">
            Why Choose Fiestaflare?
          </h2>
          <p className="text-joy-gray-500 max-w-2xl mx-auto">
            Your trusted B2B partner for wholesale accessories, pet supplies & creative gifts
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {reasons.map((item) => (
            <div key={item.title} className="text-center group">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white shadow-sm border border-orange-100 flex items-center justify-center group-hover:shadow-md group-hover:-translate-y-1 transition-all duration-300">
                {item.icon === 'Factory' && <Icons.Factory size={28} className="text-joy-orange" />}
                {item.icon === 'Globe' && <Icons.Globe size={28} className="text-joy-orange" />}
                {item.icon === 'ShieldCheck' && <Icons.ShieldCheck size={28} className="text-joy-orange" />}
                {item.icon === 'Package' && <Icons.Package size={28} className="text-joy-orange" />}
                {item.icon === 'Headphones' && <Icons.Headphones size={28} className="text-joy-orange" />}
                {item.icon === 'Edit3' && <Icons.Edit3 size={28} className="text-joy-orange" />}
              </div>
              <h3 className="font-semibold text-sm text-joy-gray-900 mb-1">{item.title}</h3>
              <p className="text-xs text-joy-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

'use client'

import { Icons } from '@/components/ui/Icons'

const steps = [
  {
    step: '1',
    title: 'Place Order',
    desc: 'Select products & quantity, submit your order',
  },
  {
    step: '2',
    title: 'Quality Check',
    desc: 'Every item inspected before shipping',
  },
  {
    step: '3',
    title: 'Secure Packaging',
    desc: 'Professional packaging to protect your goods',
  },
  {
    step: '4',
    title: 'Global Delivery',
    desc: 'Ship to your door in 15-20 days',
  },
]

const shippingOptions = [
  { region: 'North America', time: '15-20 days', shipping: 'Free $299+', note: 'Standard rate $15' },
  { region: 'South America', time: '20-25 days', shipping: 'Free $499+', note: 'Standard rate $25' },
  { region: 'Europe', time: '20-25 days', shipping: 'Free $499+', note: 'Standard rate $25' },
  { region: 'Asia Pacific', time: '15-20 days', shipping: 'Free $299+', note: 'Standard rate $20' },
]

export function QualityLogistics() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Quality Process */}
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">
            How We Ensure Quality
          </h2>
          <p className="text-joy-gray-500">
            From factory to your door — every step matters
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {steps.map((item, i) => (
            <div key={i} className="relative text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-joy-orange text-white flex items-center justify-center font-bold text-xl">
                {item.step}
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-7 left-[60%] w-[80%] h-0.5 bg-orange-200" />
              )}
              <h3 className="font-semibold text-joy-gray-900 mb-1">{item.title}</h3>
              <p className="text-xs text-joy-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Shipping Info */}
        <div className="bg-joy-gray-50 rounded-2xl p-6 lg:p-8">
          <h3 className="font-bold text-lg text-joy-gray-900 mb-6 text-center">
            Shipping Information
          </h3>
          <div className="grid md:grid-cols-4 gap-4">
            {shippingOptions.map((opt) => (
              <div key={opt.region} className="bg-white rounded-xl p-4 border border-joy-gray-100">
                <h4 className="font-semibold text-sm text-joy-gray-900 mb-2">{opt.region}</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2 text-joy-gray-600">
                    <Icons.Truck size={14} className="text-joy-orange" />
                    <span>{opt.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-joy-green font-medium">
                    <Icons.Check size={14} />
                    <span>{opt.shipping}</span>
                  </div>
                  <div className="text-joy-gray-400">{opt.note}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-joy-gray-400 mt-4">
            * Shipping rates are estimates. Final cost calculated at checkout.
          </p>
        </div>
      </div>
    </section>
  )
}

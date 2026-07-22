import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { SubscribeModal } from '@/components/shop/SubscribeModal'
import { ProductCard } from '@/components/shop/ProductCard'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { formatCurrency, getPriceByTier } from '@/lib/utils'
import { SCENE_COLLECTIONS, TRUST_BADGES, SHIPPING_ZONES, type Product } from '@/types'

// Mock data - In production, this would come from Prisma/DB
const FEATURED_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Yiwu Crystal Beaded Statement Necklace',
    slug: 'yiwu-crystal-beaded-necklace',
    description: 'Stunning crystal beaded necklace perfect for retail or wholesale',
    shortDesc: 'Crystal beaded elegance',
    price: 12.99,
    comparePrice: 18.99,
    wholesalePrice: 8.99,
    vipPrice: 6.99,
    minOrderQty: 3,
    weight: 0.15,
    images: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600'],
    modelImage: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
    sku: 'AC-001',
    inventory: 150,
    category: { id: '1', name: 'Accessories', slug: 'accessories' },
    isTrending: true,
    tags: [{ name: 'Best Seller' }],
    isFeatured: true,
  },
  {
    id: '2',
    name: 'Pet Collar with LED Light - USB Rechargeable',
    slug: 'pet-collar-led-light',
    description: 'Safety LED collar for dogs and cats. USB rechargeable, multiple colors.',
    shortDesc: 'Keep your pet safe at night',
    price: 15.99,
    comparePrice: 22.99,
    wholesalePrice: 11.99,
    vipPrice: 9.99,
    minOrderQty: 5,
    weight: 0.2,
    images: ['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600'],
    sku: 'PET-002',
    inventory: 200,
    category: { id: '2', name: 'Pet Supplies', slug: 'pet-supplies' },
    isTrending: true,
    tags: [{ name: 'FDA Approved' }],
    compliance: [{ type: 'FDA', status: 'Approved' }],
    isFeatured: true,
  },
  {
    id: '3',
    name: 'Minimalist Nordic Desk Organizer',
    slug: 'nordic-desk-organizer',
    description: 'Clean lines desk organizer. Perfect for home office or dorm.',
    shortDesc: 'Scandinavian simplicity',
    price: 28.99,
    comparePrice: 38.99,
    wholesalePrice: 22.99,
    vipPrice: 18.99,
    minOrderQty: 2,
    weight: 0.8,
    dimensions: '25x15x12cm',
    images: ['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600'],
    sku: 'HOME-003',
    inventory: 80,
    category: { id: '3', name: 'Home Décor', slug: 'home-decor' },
    isTrending: false,
    tags: [{ name: 'Nordic Style' }],
    isFeatured: true,
  },
  {
    id: '4',
    name: 'Creative LED Message Board - 12 Colors',
    slug: 'led-message-board',
    description: 'USB powered LED board with 12 colors. Draw with your finger!',
    shortDesc: 'Express yourself with light',
    price: 19.99,
    comparePrice: 29.99,
    wholesalePrice: 14.99,
    vipPrice: 12.99,
    minOrderQty: 3,
    weight: 0.5,
    images: ['https://images.unsplash.com/photo-1549490349-8643362247b5?w=600'],
    sku: 'GIFT-004',
    inventory: 120,
    category: { id: '4', name: 'Gifts', slug: 'gifts' },
    isTrending: true,
    tags: [{ name: 'Trending' }],
    isFeatured: true,
  },
  {
    id: '5',
    name: 'Ins-Style Ceramic Vase Set - 3 Pieces',
    slug: 'ins-ceramic-vase-set',
    description: 'Trendy ceramic vase set. Minimalist design for any space.',
    shortDesc: ' Instagram-worthy décor',
    price: 34.99,
    comparePrice: 45.99,
    wholesalePrice: 27.99,
    vipPrice: 22.99,
    minOrderQty: 2,
    weight: 1.2,
    dimensions: '15x15x20cm',
    images: ['https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=600'],
    sku: 'HOME-005',
    inventory: 60,
    category: { id: '3', name: 'Home Décor', slug: 'home-decor' },
    tags: [{ name: 'Instagram Famous' }],
    isFeatured: true,
  },
  {
    id: '6',
    name: 'Pet Carrier Backpack - Airline Approved',
    slug: 'pet-carrier-backpack',
    description: 'Hands-free pet carrier. Airline approved, ventilation panels.',
    shortDesc: 'Adventure with your pet',
    price: 45.99,
    comparePrice: 59.99,
    wholesalePrice: 38.99,
    vipPrice: 32.99,
    minOrderQty: 2,
    weight: 1.0,
    images: ['https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600'],
    modelImage: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600',
    sku: 'PET-006',
    inventory: 45,
    category: { id: '2', name: 'Pet Supplies', slug: 'pet-supplies' },
    compliance: [{ type: 'FDA', status: 'Approved' }],
    tags: [{ name: 'Travel Essential' }],
    isFeatured: true,
  },
  {
    id: '7',
    name: 'Layered Gold-Plated Charm Bracelet',
    slug: 'gold-layered-charm-bracelet',
    description: 'Elegant layered bracelet with customizable charms.',
    shortDesc: 'Stackable elegance',
    price: 8.99,
    comparePrice: 14.99,
    wholesalePrice: 5.99,
    vipPrice: 4.49,
    minOrderQty: 5,
    weight: 0.05,
    images: ['https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600'],
    modelImage: 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=600',
    sku: 'AC-007',
    inventory: 300,
    category: { id: '1', name: 'Accessories', slug: 'accessories' },
    isTrending: true,
    tags: [{ name: 'Bestseller' }],
    isFeatured: true,
  },
  {
    id: '8',
    name: 'Wireless Pet Water Fountain - 2L',
    slug: 'wireless-pet-fountain',
    description: 'Silent water fountain with filter. Perfect for cats and small dogs.',
    shortDesc: 'Hydration station',
    price: 32.99,
    comparePrice: 42.99,
    wholesalePrice: 26.99,
    vipPrice: 22.99,
    minOrderQty: 3,
    weight: 0.9,
    images: ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600'],
    sku: 'PET-008',
    inventory: 90,
    category: { id: '2', name: 'Pet Supplies', slug: 'pet-supplies' },
    compliance: [{ type: 'FDA', status: 'Approved' }],
    tags: [{ name: 'Pet Parent Favorite' }],
    isFeatured: true,
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <CartDrawer />
      <FloatingButtons />
      <SubscribeModal delay={10} />

      <main className="pt-[calc(4rem+36px)]">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-joy-gray-50 via-white to-joy-orange/5 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 py-16 lg:py-24">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Hero Content */}
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-joy-orange/10 text-joy-orange px-4 py-2 rounded-full text-sm font-medium mb-6">
                  <Icons.Zap size={16} />
                  B2B Wholesale from Yiwu, China
                </div>
                
                <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-joy-gray-900 mb-6 leading-tight">
                  <span className="text-gradient">Trending Products</span>
                  <br />
                  at Wholesale Prices
                </h1>
                
                <p className="text-lg text-joy-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                  Access high-quality accessories, pet supplies & creative gifts directly from Yiwu manufacturers. 
                  <strong className="text-joy-orange"> $50 minimum mixed order.</strong>
                </p>

                {/* Price Tiers */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
                  <p className="text-sm text-joy-gray-500 mb-4 font-medium">Three-tier pricing, automatically applied:</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-joy-gray-50 rounded-xl">
                      <div className="text-sm text-joy-gray-500 mb-1">Retail</div>
                      <div className="font-bold text-lg text-joy-gray-700">1-10 pcs</div>
                      <div className="text-xs text-joy-gray-400 mt-1">Full Price</div>
                    </div>
                    <div className="text-center p-4 bg-joy-orange/10 rounded-xl border-2 border-joy-orange">
                      <div className="text-sm text-joy-orange mb-1 font-semibold">Wholesale</div>
                      <div className="font-bold text-lg text-joy-orange">11-100 pcs</div>
                      <div className="text-xs text-joy-orange/70 mt-1">Up to 30% off</div>
                    </div>
                    <div className="text-center p-4 bg-joy-green/10 rounded-xl">
                      <div className="text-sm text-joy-green mb-1">VIP</div>
                      <div className="font-bold text-lg text-joy-green">100+ pcs</div>
                      <div className="text-xs text-joy-green/70 mt-1">Up to 50% off</div>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Link href="/products">
                    <Button variant="south" size="lg">
                      Shop Now
                      <Icons.ChevronRight size={20} className="ml-1" />
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="secondary" size="lg">
                      Create Account
                    </Button>
                  </Link>
                </div>

                {/* Trust Indicators */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 mt-10 text-sm text-joy-gray-500">
                  <span className="flex items-center gap-2">
                    <Icons.ShieldCheck size={18} className="text-joy-green" />
                    Safe & Secure
                  </span>
                  <span className="flex items-center gap-2">
                    <Icons.Truck size={18} className="text-joy-orange" />
                    World Shipping
                  </span>
                  <span className="flex items-center gap-2">
                    <Icons.RefreshCw size={18} className="text-joy-pink" />
                    30-Day Returns
                  </span>
                </div>
              </div>

              {/* Hero Image/Grid */}
              <div className="relative hidden lg:block">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="rounded-2xl overflow-hidden shadow-xl">
                      <img
                        src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400"
                        alt="Jewelry"
                        className="w-full h-48 object-cover"
                      />
                    </div>
                    <div className="rounded-2xl overflow-hidden shadow-xl">
                      <img
                        src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400"
                        alt="Pet supplies"
                        className="w-full h-64 object-cover"
                      />
                    </div>
                  </div>
                  <div className="space-y-4 pt-8">
                    <div className="rounded-2xl overflow-hidden shadow-xl">
                      <img
                        src="https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400"
                        alt="Home decor"
                        className="w-full h-64 object-cover"
                      />
                    </div>
                    <div className="rounded-2xl overflow-hidden shadow-xl">
                      <img
                        src="https://images.unsplash.com/photo-1549490349-8643362247b5?w=400"
                        alt="Gifts"
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Floating Badge */}
                <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-4 animate-float">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-joy-orange/10 flex items-center justify-center">
                      <Icons.Package size={24} className="text-joy-orange" />
                    </div>
                    <div>
                      <p className="font-bold text-joy-gray-900">50,000+</p>
                      <p className="text-xs text-joy-gray-500">Products Available</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scene Collections */}
        <section className="py-16 lg:py-24 bg-joy-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-joy-gray-900 mb-4">
                Shop by Scene
              </h2>
              <p className="text-joy-gray-600 max-w-2xl mx-auto">
                Not sure what you're looking for? Browse our curated collections by lifestyle.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {SCENE_COLLECTIONS.map((collection) => (
                <Link
                  key={collection.slug}
                  href={`/products?collection=${collection.slug}`}
                  className="scene-card group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-joy-orange/80 via-joy-pink/80 to-joy-green/80" />
                  <div className="scene-card-content text-white">
                    <div className="text-3xl mb-2">{collection.emoji}</div>
                    <h3 className="font-bold text-lg">{collection.name}</h3>
                    <p className="text-sm text-white/80">{collection.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Trending Products */}
        <section className="py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-12">
              <div>
                <div className="flex items-center gap-2 text-joy-orange font-semibold mb-2">
                  <Icons.Zap size={20} />
                  Hot Right Now
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-joy-gray-900">
                  Trending Products
                </h2>
              </div>
              <Link href="/products?sort=trending">
                <Button variant="secondary">
                  View All
                  <Icons.ChevronRight size={18} className="ml-1" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {FEATURED_PRODUCTS.filter(p => p.isTrending).slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>

        {/* Shipping Promise - South America Focus */}
        <section className="py-16 bg-gradient-to-r from-joy-orange via-joy-pink to-joy-green">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center text-white mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                🚚 Direct to Your Door
              </h2>
              <p className="text-white/90 max-w-2xl mx-auto">
                We ship worldwide from Yiwu. Whether you're in New York or São Paulo, we've got you covered.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* North America */}
              <div className="bg-white rounded-3xl p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-joy-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Icons.MapPin size={32} className="text-joy-navy" />
                </div>
                <h3 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">
                  North America
                </h3>
                <p className="text-joy-gray-600 mb-4">USA, Canada, Mexico</p>
                <div className="text-4xl font-bold text-joy-navy mb-2">7-10 Days</div>
                <p className="text-sm text-joy-gray-500 mb-4">Standard Shipping</p>
                <div className="flex items-center justify-center gap-2 text-joy-green font-medium">
                  <Icons.Check size={18} />
                  Free shipping on orders $299+
                </div>
                <div className="mt-4 text-joy-gray-600">From $12.99</div>
              </div>

              {/* South America */}
              <div className="bg-white rounded-3xl p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-joy-orange/10 flex items-center justify-center mx-auto mb-4">
                  <Icons.Truck size={32} className="text-joy-orange" />
                </div>
                <h3 className="font-display text-2xl font-bold text-joy-gray-900 mb-2">
                  South America
                </h3>
                <p className="text-joy-gray-600 mb-4">Brazil, Argentina, Colombia, Chile...</p>
                <div className="text-4xl font-bold text-joy-orange mb-2">15-20 Days</div>
                <p className="text-sm text-joy-gray-500 mb-4">Express Shipping</p>
                <div className="flex items-center justify-center gap-2 text-joy-green font-medium">
                  <Icons.Check size={18} />
                  Free shipping on orders $499+
                </div>
                <div className="mt-4 text-joy-gray-600">From $18.99</div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Products Grid */}
        <section className="py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-12">
              <div>
                <div className="flex items-center gap-2 text-joy-pink font-semibold mb-2">
                  <Icons.Sparkles size={20} />
                  Curated Selection
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-joy-gray-900">
                  Featured Products
                </h2>
              </div>
              <Link href="/products">
                <Button variant="secondary">
                  Browse All
                  <Icons.ChevronRight size={18} className="ml-1" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {FEATURED_PRODUCTS.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>

        {/* Why JoyHub */}
        <section className="py-16 lg:py-24 bg-joy-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Why JoyHub?
              </h2>
              <p className="text-joy-gray-400 max-w-2xl mx-auto">
                We're not just a supplier. We're your cross-border e-commerce partner.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  icon: Icons.Package,
                  title: 'Direct from Yiwu',
                  description: 'Factory-direct pricing with no middlemen. The lowest wholesale prices guaranteed.',
                },
                {
                  icon: Icons.ShieldCheck,
                  title: 'Quality Assured',
                  description: 'Every product is inspected before shipping. FDA compliance for pet products.',
                },
                {
                  icon: Icons.Globe,
                  title: 'Global Reach',
                  description: 'Shipping to 150+ countries. Dedicated support in English and Spanish.',
                },
                {
                  icon: Icons.Zap,
                  title: 'Fast Fulfillment',
                  description: 'Orders ship within 24 hours. Real-time tracking on every shipment.',
                },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-joy-orange to-joy-pink flex items-center justify-center mx-auto mb-4">
                    <item.icon size={28} />
                  </div>
                  <h3 className="font-bold text-xl mb-2">{item.title}</h3>
                  <p className="text-joy-gray-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 lg:py-24 bg-gradient-to-br from-joy-orange/10 via-joy-pink/10 to-joy-green/10">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-joy-gray-900 mb-6">
              Ready to Start Selling?
            </h2>
            <p className="text-lg text-joy-gray-600 mb-8 max-w-2xl mx-auto">
              Join thousands of retailers and dropshippers who trust JoyHub Wholesale for their inventory.
              Create your free account today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button variant="south" size="xl">
                  Create Free Account
                  <Icons.ChevronRight size={20} className="ml-2" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="secondary" size="xl">
                  Contact Sales
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-joy-gray-500">
              No credit card required • Instant access to wholesale pricing
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

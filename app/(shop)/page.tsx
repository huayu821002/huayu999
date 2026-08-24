import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { SubscribeModal } from '@/components/shop/SubscribeModal'
import { ProductCard } from '@/components/shop/ProductCard'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import type { Product } from '@/types'

const defaultCategories = [
  { id: 'cat-1', name: 'Accessories', slug: 'accessories', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400', count: 0 },
  { id: 'cat-2', name: 'Pet Supplies', slug: 'pet-supplies', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', count: 0 },
  { id: 'cat-3', name: 'Home Decor', slug: 'home-decor', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', count: 0 },
  { id: 'cat-4', name: 'Gifts', slug: 'gifts', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400', count: 0 },
]

const defaultTrustBadges = [
  { icon: 'ShieldCheck', title: 'Quality Assured', desc: 'Every product inspected before shipping' },
  { icon: 'Truck', title: 'Global Shipping', desc: '150+ countries supported' },
  { icon: 'Package', title: 'Low Minimums', desc: 'Order from just 3 units' },
  { icon: 'RefreshCw', title: 'Easy Returns', desc: '30-day hassle-free returns' },
]

const defaultHeaderSettings = {
  promoBanner: {
    enabled: true,
    text: "🎉 $50 Minimum Mixed Order | Free Shipping NA $299+ | SA $499+ 🚚 15-20 Days Worldwide"
  },
  logo: { type: "text" as const, text: "Fiestaflare", image: "" },
  navLinks: [
    { href: "/", label: "Home" },
    { href: "/products", label: "Products" },
    { href: "/products?collection=trending-now", label: "🔥 Trending" },
    { href: "/products?collection=pet-me", label: "🐾 Pet & Me" },
    { href: "/info/about-us", label: "About" },
    { href: "/info/contact", label: "Contact" }
  ]
}

// 并行获取所有首页数据
async function getHomePageData() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // 并行执行所有查询，每个都限制返回数量
  const [featuredProducts, newArrivalProducts, allProductsLimited, categoriesSetting, trustBadgesSetting, headerFooterSetting, bannersSetting] = await Promise.all([
    // 精选产品
    prisma.product.findMany({
      where: { isFeatured: true, isActive: true },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    }),
    // 新到货产品（数据库层面过滤，只取最近30天的）
    prisma.product.findMany({
      where: {
        isActive: true,
        createdAt: { gte: thirtyDaysAgo },
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    }),
    // 备用产品（如果没有精选，取前8个最新的）
    prisma.product.findMany({
      where: { isActive: true },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    }),
    prisma.siteSetting.findUnique({ where: { key: 'homepage_categories' } }),
    prisma.siteSetting.findUnique({ where: { key: 'homepage_trust_badges' } }),
    prisma.siteSetting.findUnique({ where: { key: 'header_settings' } }),
    prisma.siteSetting.findUnique({ where: { key: 'homepage_banners' } }),
  ])

  // 解析分类数据
  let categories = defaultCategories
  if (categoriesSetting?.value) {
    try {
      const parsed = JSON.parse(categoriesSetting.value)
      if (Array.isArray(parsed) && parsed.length > 0) categories = parsed
    } catch {}
  }

  // 解析信任徽章数据
  let trustBadges = defaultTrustBadges
  if (trustBadgesSetting?.value) {
    try {
      const parsed = JSON.parse(trustBadgesSetting.value)
      if (Array.isArray(parsed) && parsed.length > 0) trustBadges = parsed
    } catch {}
  }

  // 如果没有精选产品，用全部产品的前8个
  const displayProducts = featuredProducts.length > 0 ? featuredProducts : allProductsLimited

  // 计算所有产品的已售数量
  const allProductIds = Array.from(new Set([...displayProducts, ...newArrivalProducts].map(p => p.id)))
  const soldCounts = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      productId: { in: allProductIds },
      order: { status: { in: ['PROCESSING', 'SHIPPED', 'DELIVERED'] } },
    },
    _sum: { quantity: true },
  })
  const soldCountMap = new Map(soldCounts.map(s => [s.productId, s._sum.quantity || 0]))

  const addSoldCount = (p: any) => ({ ...p, soldCount: soldCountMap.get(p.id) || 0 })
  const displayProductsWithSold = displayProducts.map(addSoldCount)
  const newArrivalProductsWithSold = newArrivalProducts.map(addSoldCount)

  // 解析 header 设置
  let headerSettings = defaultHeaderSettings
  if (headerFooterSetting?.value) {
    try {
      const parsed = JSON.parse(headerFooterSetting.value)
      if (parsed.header) headerSettings = parsed.header
    } catch {}
  }

  // 解析 banners
  let banners: any[] = []
  if (bannersSetting?.value) {
    try {
      const parsed = JSON.parse(bannersSetting.value)
      if (Array.isArray(parsed)) banners = parsed
    } catch {}
  }

  return {
    featuredProducts: displayProductsWithSold as unknown as Product[],
    newArrivalProducts: newArrivalProductsWithSold as unknown as Product[],
    categories,
    trustBadges,
    headerSettings,
    banners,
  }
}

export default async function ShopHomePage() {
  const { featuredProducts, newArrivalProducts, categories, trustBadges, headerSettings, banners } = await getHomePageData()

  const showNewArrivals = newArrivalProducts.length > 0

  return (
    <div className="min-h-screen bg-white">
      <Header initialSettings={headerSettings} />
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Huayu Wholesale',
            url: 'https://huayu-ebon.vercel.app',
            logo: 'https://huayu-ebon.vercel.app/logo.png',
            description: 'B2B small wholesale platform for accessories, pet supplies, creative gifts, and home décor.',
            contactPoint: {
              '@type': 'ContactPoint',
              contactType: 'customer service',
              availableLanguage: 'English',
            },
            sameAs: []
          })
        }} />

        {/* Hero Carousel */}
        <HeroCarousel initialBanners={banners} />

        {/* Trust Badges */}
        <section className="bg-joy-gray-50 py-8 border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {trustBadges.map((badge: any) => (
                <div key={badge.title} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-joy-orange/10 flex items-center justify-center flex-shrink-0">
                    {badge.icon === 'ShieldCheck' && <Icons.ShieldCheck size={20} className="text-joy-orange" />}
                    {badge.icon === 'Truck' && <Icons.Truck size={20} className="text-joy-orange" />}
                    {badge.icon === 'Package' && <Icons.Package size={20} className="text-joy-orange" />}
                    {badge.icon === 'RefreshCw' && <Icons.RefreshCw size={20} className="text-joy-orange" />}
                    {badge.icon === 'MessageCircle' && <Icons.MessageCircle size={20} className="text-joy-orange" />}
                    {badge.icon === 'Star' && <Icons.Star size={20} className="text-joy-orange" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-joy-gray-900">{badge.title}</p>
                    <p className="text-xs text-joy-gray-500">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* New Arrivals Section */}
        {showNewArrivals && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-joy-orange text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                      NEW
                    </span>
                    <h2 className="font-display text-2xl font-bold text-joy-gray-900">
                      New Arrivals
                    </h2>
                  </div>
                  <p className="text-joy-gray-500 mt-1">
                    Fresh from the factory - just landed!
                  </p>
                </div>
                <Link href="/products?sort=newest">
                  <Button variant="secondary">
                    View All <Icons.ChevronRight size={18} className="ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {newArrivalProducts.map((product) => (
                  <ProductCard key={product.id} product={product} isNew />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Categories */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-2xl font-bold text-joy-gray-900">
                Shop by Category
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <Link key={cat.id} href={`/products?category=${cat.slug}`} className="group relative rounded-2xl overflow-hidden aspect-[4/3]">
                  <Image src={cat.image} alt={cat.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="font-semibold text-lg text-white">{cat.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-16 bg-joy-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-joy-gray-900">
                  Featured Products
                </h2>
                <p className="text-joy-gray-500 mt-1">
                  Handpicked bestsellers at wholesale prices
                </p>
              </div>
              <Link href="/products">
                <Button variant="secondary">
                  Browse All <Icons.ChevronRight size={18} className="ml-1" />
                </Button>
              </Link>
            </div>
            {featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-joy-gray-500">
                <Icons.Package size={48} className="mx-auto mb-4 opacity-30" />
                <p>No products yet. Add products from the admin panel.</p>
                <Link href="/admin/dashboard" className="text-joy-orange hover:underline mt-2 inline-block">Go to Admin</Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <FloatingButtons />
      <CartDrawer />
      <SubscribeModal />
    </div>
  )
}

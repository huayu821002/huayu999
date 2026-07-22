'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { cn, formatCurrency, getPriceByTier, convertPrice } from '@/lib/utils'
import { useCartStore, useWishlistStore } from '@/lib/store'
import { SCENE_COLLECTIONS } from '@/types'

// Mock product data - in production, fetch from DB
const MOCK_PRODUCT = {
  id: '1',
  name: 'Yiwu Crystal Beaded Statement Necklace',
  slug: 'yiwu-crystal-beaded-necklace',
  description: `Elevate your inventory with this stunning crystal beaded statement necklace. 

Perfect for boutique owners and retailers looking for high-margin accessories. This piece features:

• Premium quality crystals with brilliant sparkle
• Adjustable length (16-22 inches)
• Lead-free and nickel-free
• Durable lobster claw clasp
• Elegant gift box included

Ideal for fashion-forward customers aged 18-45. Pairs beautifully with casual and formal attire.`,
  shortDesc: 'Premium crystal beaded necklace with adjustable length',
  price: 12.99,
  comparePrice: 18.99,
  wholesalePrice: 8.99,
  vipPrice: 6.99,
  minOrderQty: 3,
  weight: 0.15,
  dimensions: '25cm x 3cm',
  images: [
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800',
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800',
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800',
  ],
  modelImage: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800',
  sku: 'AC-001',
  barcode: '8901234567890',
  inventory: 150,
  lowStockAlert: 10,
  category: { id: '1', name: 'Accessories', slug: 'accessories' },
  tags: [{ name: 'Bestseller' }, { name: 'Trending' }],
  variants: [
    { id: 'v1', name: 'Color', value: 'Gold', sku: 'AC-001-G', price: 12.99, inventory: 75 },
    { id: 'v2', name: 'Color', value: 'Silver', sku: 'AC-001-S', price: 12.99, inventory: 60 },
    { id: 'v3', name: 'Color', value: 'Rose Gold', sku: 'AC-001-RG', price: 14.99, inventory: 15 },
  ],
  compliance: [{ type: 'CPSIA', status: 'Compliant' }],
  isTrending: true,
  isFeatured: true,
  createdAt: new Date('2024-01-15'),
}

export default function ProductDetailPage() {
  const params = useParams()
  const { currency } = useCartStore()
  const { isInWishlist, toggleItem } = useWishlistStore()
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(3)
  const [isAdding, setIsAdding] = useState(false)
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews'>('description')

  const product = MOCK_PRODUCT
  const inWishlist = isInWishlist(product.id)

  const currentVariant = product.variants?.find(v => v.id === selectedVariant)
  const displayPrice = currentVariant?.price || product.price
  const priceByQty = getPriceByTier(displayPrice, quantity, currency)

  const handleAddToCart = async () => {
    setIsAdding(true)
    // Add to cart logic
    await new Promise(resolve => setTimeout(resolve, 500))
    useCartStore.getState().addItem(product, quantity, currentVariant || undefined)
    setIsAdding(false)
  }

  const relatedProducts = SCENE_COLLECTIONS.slice(0, 4)

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <CartDrawer />
      <FloatingButtons 
        productUrl={`https://joyhubwholesale.com/products/${product.slug}`}
        productName={product.name}
      />

      <main className="pt-[calc(4rem+36px)]">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-joy-gray-500">
            <Link href="/" className="hover:text-joy-orange">Home</Link>
            <Icons.ChevronRight size={14} />
            <Link href="/products" className="hover:text-joy-orange">Products</Link>
            <Icons.ChevronRight size={14} />
            <Link href={`/products?category=${product.category.slug}`} className="hover:text-joy-orange">
              {product.category.name}
            </Link>
            <Icons.ChevronRight size={14} />
            <span className="text-joy-gray-900">{product.name}</span>
          </nav>
        </div>

        {/* Product Section */}
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Image Gallery */}
            <div>
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-joy-gray-100 mb-4">
                <img
                  src={product.images[selectedImage] || '/placeholder.png'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {product.isTrending && (
                    <span className="bg-joy-orange text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                      <Icons.Zap size={12} />
                      Trending
                    </span>
                  )}
                  {product.comparePrice && (
                    <span className="bg-joy-pink text-white text-xs font-bold px-3 py-1.5 rounded-full">
                      -{Math.round((1 - product.price / product.comparePrice) * 100)}% OFF
                    </span>
                  )}
                </div>

                {/* Wishlist */}
                <button
                  onClick={() => toggleItem(product.id)}
                  className={cn(
                    'absolute top-4 right-4 w-12 h-12 rounded-full flex items-center justify-center transition-all',
                    inWishlist
                      ? 'bg-joy-pink text-white'
                      : 'bg-white/90 text-joy-gray-400 hover:text-joy-pink'
                  )}
                >
                  <Icons.Heart size={24} fill={inWishlist ? 'currentColor' : 'none'} />
                </button>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      'w-20 h-20 rounded-xl overflow-hidden border-2 transition-all',
                      selectedImage === i ? 'border-joy-orange' : 'border-transparent hover:border-joy-gray-300'
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                {product.modelImage && (
                  <button
                    onClick={() => setSelectedImage(product.images.length)}
                    className={cn(
                      'w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex items-center justify-center text-xs font-medium',
                      selectedImage === product.images.length 
                        ? 'border-joy-orange bg-joy-orange/10 text-joy-orange' 
                        : 'border-joy-gray-200 hover:border-joy-gray-300'
                    )}
                  >
                    Model View
                  </button>
                )}
              </div>
            </div>

            {/* Product Info */}
            <div>
              {/* SKU & Category */}
              <div className="flex items-center gap-4 mb-2">
                <span className="text-sm text-joy-gray-500">SKU: {product.sku}</span>
                <span className="text-sm text-joy-gray-400">|</span>
                <Link href={`/products?category=${product.category.slug}`} className="text-sm text-joy-orange hover:underline">
                  {product.category.name}
                </Link>
              </div>

              {/* Title */}
              <h1 className="font-display text-3xl font-bold text-joy-gray-900 mb-4">
                {product.name}
              </h1>

              {/* Price Display */}
              <div className="bg-joy-gray-50 rounded-2xl p-6 mb-6">
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-4xl font-bold text-joy-orange">
                    {formatCurrency(convertPrice(priceByQty.price, currency), currency)}
                  </span>
                  {product.comparePrice && (
                    <span className="text-xl text-joy-gray-400 line-through">
                      {formatCurrency(convertPrice(product.comparePrice, currency), currency)}
                    </span>
                  )}
                </div>

                {/* Tier Prices */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center p-3 bg-white rounded-xl">
                    <div className="text-joy-gray-500 mb-1">1-10 pcs</div>
                    <div className="font-semibold">{formatCurrency(convertPrice(getPriceByTier(displayPrice, 1, currency).price, currency), currency)}</div>
                  </div>
                  <div className="text-center p-3 bg-joy-orange/10 rounded-xl border-2 border-joy-orange">
                    <div className="text-joy-orange font-semibold mb-1">11-100 pcs</div>
                    <div className="font-bold text-joy-orange">{formatCurrency(convertPrice(getPriceByTier(displayPrice, 50, currency).price, currency), currency)}</div>
                  </div>
                  <div className="text-center p-3 bg-joy-green/10 rounded-xl">
                    <div className="text-joy-green mb-1">100+ pcs</div>
                    <div className="font-semibold text-joy-green">{formatCurrency(convertPrice(getPriceByTier(displayPrice, 200, currency).price, currency), currency)}</div>
                  </div>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-joy-gray-700 mb-2">
                  Quantity (Min. order: {product.minOrderQty})
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border-2 border-joy-gray-200 rounded-xl">
                    <button
                      onClick={() => setQuantity(Math.max(product.minOrderQty, quantity - 1))}
                      className="p-3 hover:bg-joy-gray-50 transition-colors"
                    >
                      <Icons.Minus size={18} />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(product.minOrderQty, parseInt(e.target.value) || product.minOrderQty))}
                      className="w-20 text-center font-semibold border-none focus:outline-none"
                    />
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-3 hover:bg-joy-gray-50 transition-colors"
                    >
                      <Icons.Plus size={18} />
                    </button>
                  </div>
                  <span className="text-sm text-joy-gray-500">
                    {product.inventory} in stock
                  </span>
                </div>
              </div>

              {/* Variants */}
              {product.variants && product.variants.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-joy-gray-700 mb-2">
                    {product.variants[0].name}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant.id)}
                        className={cn(
                          'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                          selectedVariant === variant.id
                            ? 'bg-joy-orange text-white'
                            : 'bg-joy-gray-100 text-joy-gray-700 hover:bg-joy-gray-200'
                        )}
                      >
                        {variant.value}
                        {variant.inventory < 10 && ` (${variant.inventory} left)`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add to Cart */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Button
                  onClick={handleAddToCart}
                  isLoading={isAdding}
                  size="xl"
                  className="flex-1"
                >
                  <Icons.ShoppingCart size={20} className="mr-2" />
                  Add to Cart
                </Button>
                <Button
                  variant="secondary"
                  size="xl"
                  onClick={() => toggleItem(product.id)}
                >
                  <Icons.Heart size={20} className="mr-2" />
                  {inWishlist ? 'In Wishlist' : 'Add to Wishlist'}
                </Button>
              </div>

              {/* WhatsApp Inquiry */}
              <a
                href={`https://wa.me/12025551234?text=Hi! I'm interested in: ${encodeURIComponent(product.name)} (SKU: ${product.sku})`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 bg-[#25D366] text-white rounded-xl font-semibold hover:bg-[#20bd5a] transition-colors mb-6"
              >
                <Icons.WhatsApp size={24} />
                Inquire via WhatsApp
              </a>

              {/* Trust Badges */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 p-3 bg-joy-gray-50 rounded-xl">
                  <Icons.Truck size={20} className="text-joy-orange" />
                  <span>Ships in 24h</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-joy-gray-50 rounded-xl">
                  <Icons.RefreshCw size={20} className="text-joy-pink" />
                  <span>30-Day Returns</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-joy-gray-50 rounded-xl">
                  <Icons.ShieldCheck size={20} className="text-joy-green" />
                  <span>Quality Assured</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-joy-gray-50 rounded-xl">
                  <Icons.Globe size={20} className="text-joy-navy" />
                  <span>Worldwide Shipping</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Details Tabs */}
          <div className="mt-16">
            <div className="flex border-b border-joy-gray-200">
              {(['description', 'specs', 'reviews'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-6 py-4 font-medium text-sm capitalize transition-colors border-b-2 -mb-px',
                    activeTab === tab
                      ? 'text-joy-orange border-joy-orange'
                      : 'text-joy-gray-500 border-transparent hover:text-joy-gray-700'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="py-8">
              {activeTab === 'description' && (
                <div className="prose max-w-none">
                  {product.description.split('\n').map((p, i) => (
                    <p key={i} className="mb-4 text-joy-gray-700">{p}</p>
                  ))}
                </div>
              )}

              {activeTab === 'specs' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">SKU</span>
                      <span className="font-medium">{product.sku}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">Barcode</span>
                      <span className="font-medium">{product.barcode}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">Category</span>
                      <span className="font-medium">{product.category.name}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">Min Order</span>
                      <span className="font-medium">{product.minOrderQty} pcs</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">Weight</span>
                      <span className="font-medium">{product.weight} kg</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">Dimensions</span>
                      <span className="font-medium">{product.dimensions}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">Inventory</span>
                      <span className="font-medium">{product.inventory} units</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">Compliance</span>
                      <span className="font-medium">
                        {product.compliance?.map(c => c.type).join(', ') || 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-joy-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Icons.Star size={32} className="text-joy-gray-300" />
                  </div>
                  <h3 className="font-semibold text-joy-gray-900 mb-2">No reviews yet</h3>
                  <p className="text-joy-gray-500 mb-4">Be the first to review this product</p>
                  <Button variant="secondary">Write a Review</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

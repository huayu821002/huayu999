'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { FloatingButtons } from '@/components/layout/FloatingButtons'
import { ProductCard } from '@/components/shop/ProductCard'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { cn, formatCurrency, getPriceByTier, convertPrice } from '@/lib/utils'
import { useCartStore, useWishlistStore } from '@/lib/store'
import { parseProductImages, parseImageUrl } from '@/lib/imageUtils'

interface ProductVariant {
  id: string
  name: string
  value: string
  sku: string | null
  price: number | null
  inventory: number
  image: string | null
}

interface Product {
  id: string
  name: string
  slug: string
  description?: string | null
  shortDesc?: string | null
  price: number
  comparePrice?: number | null
  costPrice?: number | null
  wholesalePrice?: number | null
  vipPrice?: number | null
  minOrderQty: number
  inventory: number
  lowStockAlert?: number | null
  weight?: number | null
  dimensions?: string | null
  images: string[]
  modelImage?: string | null
  sku?: string | null
  barcode?: string | null
  category?: { id: string; name: string; slug: string } | null
  tags?: string | null
  variants: ProductVariant[]
  compliance?: { type: string; status: string } | null
  isTrending?: boolean
  isFeatured?: boolean
  createdAt?: string
}

export default function ProductDetailPage() {
  const params = useParams()
  const { currency } = useCartStore()
  const { isInWishlist, toggleItem } = useWishlistStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(3)
  const [isAdding, setIsAdding] = useState(false)
  const [activeTab, setActiveTab] = useState<'description' | 'specs'>('description')

  // Parse images helper - uses imported parseProductImages for string | string[] support

  useEffect(() => {
    fetchProduct()
  }, [params.slug])

  const fetchProduct = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/products/${params.slug}`)
      const data = await res.json()
      if (data.success) {
        setProduct(data.data)
        // Set default variant if exists
        if (data.data.variants?.length > 0) {
          setSelectedVariant(data.data.variants[0].id)
        }
        // Fetch related products (same category)
        if (data.data.category?.slug) {
          fetchRelatedProducts(data.data.category.slug, data.data.id)
        }
      } else {
        setError(data.error || 'Product not found')
      }
    } catch (err) {
      console.error('Failed to fetch product:', err)
      setError('Failed to load product')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRelatedProducts = async (categorySlug: string, currentProductId: string) => {
    try {
      const res = await fetch(`/api/products?category=${categorySlug}`)
      const data = await res.json()
      if (data.success && data.data) {
        // Filter out current product, transform images to string[], and limit to 8
        const related: Product[] = data.data
          .filter((p: any) => p.id !== currentProductId)
          .slice(0, 8)
          .map((p: any) => ({
            ...p,
            images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images,
          }))
        setRelatedProducts(related)
      }
    } catch (err) {
      console.error('Failed to fetch related products:', err)
    }
  }

  const handleAddToCart = async () => {
    if (!product) return
    setIsAdding(true)
    const currentVariant = product.variants?.find(v => v.id === selectedVariant)
    // Convert API product to cart-compatible format
    const cartProduct = {
      ...product,
      images: parseProductImages(product.images),
      sku: product.sku || '',
    }
    const cartVariant = currentVariant ? {
      ...currentVariant,
      sku: currentVariant.sku || undefined,
    } : undefined
    useCartStore.getState().addItem(cartProduct as any, quantity, cartVariant as any)
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsAdding(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-[calc(4rem+36px)]">
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="animate-pulse space-y-8">
              <div className="grid lg:grid-cols-2 gap-12">
                <div className="aspect-square bg-joy-gray-200 rounded-2xl" />
                <div className="space-y-4">
                  <div className="h-8 bg-joy-gray-200 rounded w-3/4" />
                  <div className="h-6 bg-joy-gray-200 rounded w-1/4" />
                  <div className="h-32 bg-joy-gray-200 rounded" />
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-[calc(4rem+36px)]">
          <div className="max-w-7xl mx-auto px-4 py-16 text-center">
            <Icons.Package size={64} className="mx-auto mb-4 text-joy-gray-300" />
            <h1 className="text-2xl font-bold text-joy-gray-900 mb-2">Product Not Found</h1>
            <p className="text-joy-gray-500 mb-6">{error || 'The product you are looking for does not exist.'}</p>
            <Link href="/products">
              <Button>Browse Products</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const images = parseProductImages(product.images)
  const currentVariant = product.variants?.find(v => v.id === selectedVariant)
  const displayPrice = currentVariant?.price || product.price
  const priceByQty = getPriceByTier(displayPrice, quantity, currency)

  const tags = product.tags ? JSON.parse(product.tags) : []

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <CartDrawer />
      <FloatingButtons 
        productUrl={`https://fiestaflare.com/products/${product.slug}`}
        productName={product.name}
      />

      <main className="pt-[calc(4rem+36px)]">
        <link rel="canonical" href={`https://huayu-ebon.vercel.app/products/${product.slug}`} />

        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-joy-gray-500">
            <Link href="/" className="hover:text-joy-orange">Home</Link>
            <Icons.ChevronRight size={14} />
            <Link href="/products" className="hover:text-joy-orange">Products</Link>
            {product.category && (
              <>
                <Icons.ChevronRight size={14} />
                <Link href={`/products?category=${product.category.slug}`} className="hover:text-joy-orange">
                  {product.category.name}
                </Link>
              </>
            )}
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
                  src={images[selectedImage] || '/placeholder.png'}
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
                    isInWishlist(product.id)
                      ? 'bg-joy-pink text-white'
                      : 'bg-white/90 text-joy-gray-400 hover:text-joy-pink'
                  )}
                >
                  <Icons.Heart size={24} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
                </button>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-3">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      'w-20 h-20 rounded-xl overflow-hidden border-2 transition-all',
                      selectedImage === i ? 'border-joy-orange' : 'border-transparent hover:border-joy-gray-300'
                    )}
                  >
                    <img src={img} alt={`${product.name} - Image ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
                {product.modelImage && (
                  <button
                    onClick={() => setSelectedImage(images.length)}
                    className={cn(
                      'w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex items-center justify-center text-xs font-medium',
                      selectedImage === images.length 
                        ? 'border-joy-orange bg-joy-orange/10 text-joy-orange' 
                        : 'border-joy-gray-200 hover:border-joy-gray-300'
                    )}
                  >
                    Model
                  </button>
                )}
              </div>
            </div>

            {/* Product Info */}
            <div>
              {/* SKU & Category */}
              <div className="flex items-center gap-4 mb-2">
                {product.sku && <span className="text-sm text-joy-gray-500">SKU: {product.sku}</span>}
                {product.sku && <span className="text-sm text-joy-gray-400">|</span>}
                {product.category && (
                  <Link href={`/products?category=${product.category.slug}`} className="text-sm text-joy-orange hover:underline">
                    {product.category.name}
                  </Link>
                )}
              </div>

              {/* Title */}
              <h1 className="font-display text-3xl font-bold text-joy-gray-900 mb-4">
                {product.name}
              </h1>

              {/* Short Description */}
              {product.shortDesc && (
                <p className="text-joy-gray-600 mb-4">{product.shortDesc}</p>
              )}

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
                  <span className={`text-sm ${product.inventory < 20 ? 'text-red-500 font-medium' : 'text-joy-gray-500'}`}>
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
                  {isInWishlist(product.id) ? 'In Wishlist' : 'Add to Wishlist'}
                </Button>
              </div>

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
              {(['description', 'specs'] as const).map((tab) => (
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
              {activeTab === 'description' && product.description && (
                <div className="prose max-w-none">
                  {(product.description || '').split('\n').map((p, i) => (
                    <p key={i} className="mb-4 text-joy-gray-700">{p}</p>
                  ))}
                </div>
              )}

              {activeTab === 'specs' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {product.sku && (
                      <div className="flex justify-between py-3 border-b border-joy-gray-100">
                        <span className="text-joy-gray-500">SKU</span>
                        <span className="font-medium">{product.sku}</span>
                      </div>
                    )}
                    {product.barcode && (
                      <div className="flex justify-between py-3 border-b border-joy-gray-100">
                        <span className="text-joy-gray-500">Barcode</span>
                        <span className="font-medium">{product.barcode}</span>
                      </div>
                    )}
                    {product.category && (
                      <div className="flex justify-between py-3 border-b border-joy-gray-100">
                        <span className="text-joy-gray-500">Category</span>
                        <span className="font-medium">{product.category.name}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">Min Order</span>
                      <span className="font-medium">{product.minOrderQty} pcs</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {product.weight && (
                      <div className="flex justify-between py-3 border-b border-joy-gray-100">
                        <span className="text-joy-gray-500">Weight</span>
                        <span className="font-medium">{product.weight} kg</span>
                      </div>
                    )}
                    {product.dimensions && (
                      <div className="flex justify-between py-3 border-b border-joy-gray-100">
                        <span className="text-joy-gray-500">Dimensions</span>
                        <span className="font-medium">{product.dimensions}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-b border-joy-gray-100">
                      <span className="text-joy-gray-500">Inventory</span>
                      <span className="font-medium">{product.inventory} units</span>
                    </div>
                    {tags && tags.length > 0 && (
                      <div className="flex justify-between py-3 border-b border-joy-gray-100">
                        <span className="text-joy-gray-500">Tags</span>
                        <span className="font-medium">
                          {(() => {
                            try {
                              const parsed = JSON.parse(tags)
                              return Array.isArray(parsed) ? parsed.map((t: any) => t.name || t).join(', ') : tags
                            } catch {
                              return tags
                            }
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SEO: JSON-LD Product Schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.shortDesc || product.description?.substring(0, 200) || '',
            sku: product.sku || product.id,
            image: images[0] || '',
            url: `https://huayu-ebon.vercel.app/products/${product.slug}`,
            offers: {
              '@type': 'Offer',
              price: product.price?.toFixed(2) || '0.00',
              priceCurrency: currency,
              availability: product.inventory > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              seller: { '@type': 'Organization', name: 'Huayu Wholesale' }
            },
            ...(product.category ? { category: product.category.name } : {}),
          })
        }} />

        {/* You May Also Like */}
        {relatedProducts.length > 0 && (
          <section className="py-16 bg-white border-t">
            <div className="max-w-7xl mx-auto px-4">
              <h2 className="font-display text-2xl font-bold text-joy-gray-900 mb-8">You May Also Like</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} currency={currency} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}

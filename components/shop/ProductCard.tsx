'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn, formatCurrency, getPriceByTier } from '@/lib/utils'
import { useCartStore, useWishlistStore } from '@/lib/store'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { useLocale } from '@/lib/translation/client'
import { useProductTranslation } from '@/lib/translation/useProductTranslation'
import type { Product, Currency } from '@/types'

interface ProductCardProps {
  product: Product
  currency?: Currency
  showTierPrices?: boolean
  className?: string
  isNew?: boolean
}

export function ProductCard({ product, currency = 'USD', showTierPrices = true, className, isNew }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const { addItem } = useCartStore()
  const { isInWishlist, toggleItem } = useWishlistStore()
  const { locale } = useLocale()

  // Translate product name
  const { translated } = useProductTranslation(
    { name: product.name, description: product.description, shortDesc: product.shortDesc },
    locale
  )
  const displayName = translated?.name || product.name

  
  // Parse images - can be JSON array string or already an array
  const images: string[] = (() => {
    if (!product.images) return []
    if (Array.isArray(product.images)) return product.images
    try { return JSON.parse(product.images as string) } catch { return [product.images] }
  })()
  
  const inWishlist = isInWishlist(product.id)
  // Parse modelImage - can be JSON string or direct URL
  const modelImage: string | null = (() => {
    if (!product.modelImage) return null
    if (typeof product.modelImage === 'string') {
      try { return JSON.parse(product.modelImage) } catch { return product.modelImage }
    }
    return product.modelImage
  })()
  
  const hasModelImage = !!modelImage
  const hasDiscount = product.comparePrice && product.comparePrice > product.price
  const discountPercent = hasDiscount 
    ? Math.round((1 - product.price / product.comparePrice!) * 100) 
    : 0

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsAdding(true)
    addItem(product, 1)
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsAdding(false)
  }

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleItem(product.id)
  }

  // Get tier prices for display
  const retailPrice = getPriceByTier(product.price, 1, currency)
  const wholesalePrice = getPriceByTier(product.price, 50, currency)
  const vipPrice = getPriceByTier(product.price, 200, currency)

  return (
    <Link href={`/products/${product.slug}`}>
      <article
        className={cn('product-card group', className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image Section */}
        <div className="product-card-image">
          {/* Main Image */}
          <img
            src={images[0] || '/placeholder.png'}
            alt={displayName}
            className={cn(
              'w-full h-full object-cover transition-transform duration-500',
              isHovered && hasModelImage && 'opacity-0'
            )}
          />
          
          {/* Hover Model Image (for accessories with size sensitivity) */}
          {hasModelImage && (
            <img
              src={modelImage}
              alt={`${displayName} - Model view`}
              className={cn(
                'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
                isHovered ? 'opacity-100' : 'opacity-0'
              )}
            />
          )}

          {/* Discount Badge */}
          {hasDiscount && (
            <div className="absolute top-3 left-3 bg-joy-pink text-white text-xs font-bold px-2.5 py-1 rounded-full">
              -{discountPercent}%
            </div>
          )}

          {/* Trending Badge */}
          {product.isTrending && (
            <div className="absolute top-3 right-3 bg-joy-orange text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Icons.Zap size={12} />
              Trending
            </div>
          )}

          {/* New Badge */}
          {isNew && (
            <div className="absolute top-3 left-3 bg-joy-green text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
              NEW
            </div>
          )}

          {/* Wishlist Button */}
          <button
            onClick={handleToggleWishlist}
            className={cn(
              'absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
              inWishlist
                ? 'bg-joy-pink text-white'
                : 'bg-white/90 text-joy-gray-400 hover:text-joy-pink'
            )}
          >
            <Icons.Heart size={18} fill={inWishlist ? 'currentColor' : 'none'} />
          </button>

          {/* Low Stock Warning */}
          {product.inventory < 10 && product.inventory > 0 && (
            <div className="absolute bottom-16 left-3 text-xs text-joy-orange font-medium bg-white/95 px-2 py-1 rounded">
              Only {product.inventory} left!
            </div>
          )}

          {/* Out of Stock Overlay */}
          {product.inventory === 0 && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <span className="bg-joy-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-full">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4">
          {/* Category + SKU */}
          <p className="text-xs text-joy-gray-400 mb-1 uppercase">
            {product.categories?.map((c: any) => c.name).join(', ') || 'General'} · {product.sku}
          </p>
          
          {/* Product Name */}
          <h3 className="font-semibold text-joy-gray-900 mb-1 line-clamp-2 group-hover:text-joy-orange transition-colors text-sm">
            {displayName}
          </h3>

          {/* Rating Stars */}
          {product.averageRating !== undefined && product.averageRating > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm font-medium text-joy-gray-900">{product.averageRating.toFixed(1)}</span>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => {
                  const rating = product.averageRating || 0
                  const filled = i < Math.floor(rating)
                  return (
                    <svg key={i} className={cn('w-3 h-3', filled ? 'text-yellow-400 fill-current' : 'text-gray-300 fill-current')} viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )
                })}
              </div>
              {product.reviewCount !== undefined && (
                <span className="text-xs text-joy-gray-400">({product.reviewCount})</span>
              )}
            </div>
          )}

          {/* Price Section */}
          <div className="space-y-0.5 mb-3">
            {/* Retail Price (original, strikethrough if on sale) */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-medium text-joy-gray-500">Retail</span>
              {hasDiscount ? (
                <>
                  <span className="relative text-sm font-semibold text-joy-gray-400">
                    {formatCurrency(product.comparePrice!, currency)}
                    <span className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
                      <span className="absolute w-full h-0.5 bg-joy-gray-400 rotate-[-4deg]" />
                    </span>
                  </span>
                  <span className="text-sm font-bold text-joy-pink">
                    {formatCurrency(product.price, currency)}
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold text-joy-gray-900">
                  {formatCurrency(product.price, currency)}
                </span>
              )}
            </div>

            {/* Wholesale Price */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-medium text-joy-gray-500">Wholesale</span>
              <span className="text-sm font-bold text-joy-orange">
                {formatCurrency(wholesalePrice.price, currency)}
              </span>
            </div>

            {/* Member Price (obscured) */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-medium text-joy-gray-500">Member</span>
              <span className="text-sm font-bold text-joy-navy">••••</span>
            </div>
          </div>

          {/* Stock Info */}
          <div className="text-xs text-joy-gray-500 mb-3">
            {product.inventory > 0 ? (
              <span className="text-joy-green">In stock</span>
            ) : (
              <span className="text-red-500">Out of stock</span>
            )}
            {product.inventory > 0 && <span> · {product.inventory} units</span>}
          </div>

          {/* Add to Order Button */}
          <Button
            onClick={handleAddToCart}
            isLoading={isAdding}
            className="w-full bg-joy-orange hover:bg-joy-orange/90 text-white"
            size="sm"
          >
            <Icons.ShoppingCart size={16} className="mr-1" />
            Add to Order
          </Button>
        </div>
      </article>
    </Link>
  )
}

// Grid variant for better layout control
export function ProductCardGrid({ products, currency, className }: { products: Product[], currency?: Currency, className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6', className)}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} currency={currency} />
      ))}
    </div>
  )
}

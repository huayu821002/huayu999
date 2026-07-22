'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn, formatCurrency, getPriceByTier } from '@/lib/utils'
import { useCartStore, useWishlistStore } from '@/lib/store'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import type { Product, Currency } from '@/types'

interface ProductCardProps {
  product: Product
  currency?: Currency
  showTierPrices?: boolean
  className?: string
}

export function ProductCard({ product, currency = 'USD', showTierPrices = true, className }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const { addItem } = useCartStore()
  const { isInWishlist, toggleItem } = useWishlistStore()
  
  const inWishlist = isInWishlist(product.id)
  const hasModelImage = !!product.modelImage
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
            src={product.images[0] || '/placeholder.png'}
            alt={product.name}
            className={cn(
              'w-full h-full object-cover transition-transform duration-500',
              isHovered && hasModelImage && 'opacity-0'
            )}
          />
          
          {/* Hover Model Image (for accessories with size sensitivity) */}
          {hasModelImage && (
            <img
              src={product.modelImage}
              alt={`${product.name} - Model view`}
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

          {/* Quick Add Button */}
          <div
            className={cn(
              'absolute bottom-3 left-3 right-3 transition-all duration-300',
              isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            )}
          >
            <Button
              onClick={handleAddToCart}
              isLoading={isAdding}
              className="w-full bg-white/95 hover:bg-white text-joy-gray-900 shadow-lg"
              size="sm"
            >
              <Icons.Plus size={16} className="mr-1" />
              Quick Add
            </Button>
          </div>

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
          {/* SKU */}
          <p className="text-xs text-joy-gray-400 mb-1">SKU: {product.sku}</p>
          
          {/* Product Name */}
          <h3 className="font-semibold text-joy-gray-900 mb-2 line-clamp-2 group-hover:text-joy-orange transition-colors">
            {product.name}
          </h3>

          {/* Short Description */}
          {product.shortDesc && (
            <p className="text-sm text-joy-gray-500 mb-3 line-clamp-1">
              {product.shortDesc}
            </p>
          )}

          {/* Price Section */}
          <div className="space-y-1 mb-3">
            <div className="flex items-baseline gap-2">
              <span className="price-tag price-wholesale">
                {formatCurrency(product.price, currency)}
              </span>
              {hasDiscount && (
                <span className="price-tag price-retail">
                  {formatCurrency(product.comparePrice!, currency)}
                </span>
              )}
            </div>

            {/* Tier Prices (shown on hover for wholesale feel) */}
            {showTierPrices && (
              <div className={cn(
                'grid grid-cols-3 gap-1 text-xs transition-all duration-300',
                isHovered ? 'opacity-100' : 'opacity-0'
              )}>
                <div className="text-center p-1 bg-joy-gray-50 rounded">
                  <div className="text-joy-gray-400">1-10</div>
                  <div className="font-semibold text-joy-gray-700">{formatCurrency(retailPrice.price, currency)}</div>
                </div>
                <div className="text-center p-1 bg-joy-orange/10 rounded">
                  <div className="text-joy-orange">11-100</div>
                  <div className="font-semibold text-joy-orange">{formatCurrency(wholesalePrice.price, currency)}</div>
                </div>
                <div className="text-center p-1 bg-joy-green/10 rounded">
                  <div className="text-joy-green">100+</div>
                  <div className="font-semibold text-joy-green">{formatCurrency(vipPrice.price, currency)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Min Order Info */}
          <div className="flex items-center gap-2 text-xs text-joy-gray-500">
            <Icons.Package size={14} />
            <span>Min. order: {product.minOrderQty} pcs</span>
          </div>

          {/* Compliance Badges */}
          {product.compliance && product.compliance.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.compliance.slice(0, 2).map((c) => (
                <span key={c.type} className="compliance-badge text-[10px]">
                  <Icons.ShieldCheck size={10} />
                  {c.type}
                </span>
              ))}
            </div>
          )}
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

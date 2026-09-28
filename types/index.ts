export type Currency = 'USD' | 'AUD' | 'KRW' | 'JPY' | 'IDR' | 'MYR' | 'SGD'

export type UserRole = 'ADMIN' | 'CUSTOMER' | 'WHOLESALER'

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  company?: string
  phone?: string
  currency: Currency
  createdAt: Date
}

export interface Address {
  id: string
  street: string
  city: string
  state: string
  country: string
  zipCode: string
  isDefault: boolean
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  children?: Category[]
  productCount?: number
}

export interface Product {
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
  tieredPricing?: string | null
  categoryIds?: string | null // JSON array string
  categories?: Category[] // resolved from categoryIds at API level
  minOrderQty: number
  weight?: number | null
  dimensions?: string | null
  images?: string | null
  modelImage?: string | null
  sizeChart?: string | null
  sku?: string
  inventory: number
  lowStockAlert?: number
  tags?: string | null
  variants?: ProductVariant[]
  isFeatured?: boolean
  isTrending?: boolean
  isActive?: boolean
  compliance?: string | null
  averageRating?: number
  reviewCount?: number
  soldCount?: number
}

export interface ProductVariant {
  id: string
  name: string
  value: string
  sku?: string | null
  price?: number | null
  inventory: number
  image?: string | null
}

export interface CartItem {
  id: string
  product: Product
  quantity: number
  variant?: ProductVariant
  warehouseId?: string
  warehouseName?: string
}

export interface Cart {
  id: string
  items: CartItem[]
  subtotal: number
  itemCount: number
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  items: OrderItem[]
  subtotal: number
  shippingCost: number
  tax: number
  discount: number
  total: number
  currency: Currency
  shippingAddress: Address
  trackingNumber?: string
  trackingUrl?: string
  createdAt: Date
}

export interface OrderItem {
  id: string
  productName: string
  productSku: string
  price: number
  quantity: number
  total: number
  variant?: ProductVariant
}

export interface Review {
  id: string
  rating: number
  title?: string
  content?: string
  images: string[]
  isVerified: boolean
  user: { name: string }
  createdAt: Date
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Currency conversion rates (base: USD)
export const CURRENCY_RATES: Record<Currency, number> = {
  USD: 1,
  AUD: 1.53,     // 1 USD = 1.53 AUD
  KRW: 1330,     // 1 USD = 1330 KRW
  JPY: 148,      // 1 USD = 148 JPY
  IDR: 15400,   // 1 USD = 15400 IDR
  MYR: 4.6,     // 1 USD = 4.6 MYR
  SGD: 1.34,     // 1 USD = 1.34 SGD
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  AUD: 'A$',
  KRW: '₩',
  JPY: '¥',
  IDR: 'Rp',
  MYR: 'RM',
  SGD: 'S$',
}

export const CURRENCY_NAMES: Record<Currency, string> = {
  USD: 'US Dollar',
  AUD: 'Australian Dollar',
  KRW: 'South Korean Won',
  JPY: 'Japanese Yen',
  IDR: 'Indonesian Rupiah',
  MYR: 'Malaysian Ringgit',
  SGD: 'Singapore Dollar',
}

// Country code to Currency mapping
export const COUNTRY_CURRENCY: Record<string, Currency> = {
  US: 'USD',
  AU: 'AUD',
  NZ: 'AUD',
  KR: 'KRW',
  JP: 'JPY',
  ID: 'IDR',
  MY: 'MYR',
  SG: 'SGD',
}

// Currency to decimal places (IDR/KRW/JPY use 0, others use 2)
export const CURRENCY_DECIMALS: Record<Currency, number> = {
  USD: 2,
  AUD: 2,
  KRW: 0,
  JPY: 0,
  IDR: 0,
  MYR: 2,
  SGD: 2,
}

// Timezone to Currency mapping
export const TIMEZONE_CURRENCY: Record<string, Currency> = {
  // Americas
  'America/New_York': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Phoenix': 'USD',
  // Asia Pacific
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Australia/Brisbane': 'AUD',
  'Australia/Perth': 'AUD',
  'Pacific/Auckland': 'AUD',
  'Asia/Seoul': 'KRW',
  'Asia/Tokyo': 'JPY',
  'Asia/Jakarta': 'IDR',
  'Asia/Singapore': 'SGD',
  'Asia/Kuala_Lumpur': 'MYR',
}

// Price tier thresholds
export const PRICE_TIERS = {
  RETAIL: { min: 1, max: 10, label: 'Retail' },
  WHOLESALE: { min: 11, max: 100, label: 'Wholesale (11-100)' },
  VIP: { min: 101, max: Infinity, label: 'VIP (100+)' },
}

// Shipping zones
export const SHIPPING_ZONES = {
  NORTH_AMERICA: {
    name: 'North America',
    days: '7-10',
    price: 12.99,
    freeThreshold: 299,
  },
  SOUTH_AMERICA: {
    name: 'South America',
    days: '15-20',
    price: 18.99,
    freeThreshold: 499,
  },
}

// Trust badges
export const TRUST_BADGES = [
  { icon: 'Truck', text: '24h Shipping', subtext: 'Fast dispatch' },
  { icon: 'RefreshCw', text: 'Easy Return', subtext: '30-day policy' },
  { icon: 'ShieldCheck', text: 'FDA Approved', subtext: 'For pet products' },
  { icon: 'MessageCircle', text: 'Support Español', subtext: 'Native speakers' },
]

// Scene-based collections
export const SCENE_COLLECTIONS = [
  { slug: 'trending-now', name: 'Trending Now', emoji: '🔥', description: 'Hot items flying off shelves' },
  { slug: 'pet-me', name: 'Pet & Me', emoji: '🐾', description: 'Human-pet shared treasures' },
  { slug: 'dorm-decor', name: 'Dorm Decor', emoji: '🏠', description: 'Transform your space' },
  { slug: 'gift-ideas', name: 'Gift Ideas', emoji: '🎁', description: 'Perfect presents' },
  { slug: 'minimalist-living', name: 'Minimalist Living', emoji: '✨', description: 'Nordic-inspired calm' },
]

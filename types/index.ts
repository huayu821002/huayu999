export type Currency = 'USD' | 'MXN' | 'BRL'

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
  wholesalePrice?: number | null
  vipPrice?: number | null
  minOrderQty: number
  weight?: number | null
  dimensions?: string | null
  images: string[]
  modelImage?: string | null
  sizeChart?: string | null
  sku?: string | null
  inventory: number
  category?: Category | null
  tags?: string | null
  variants?: ProductVariant[]
  isFeatured?: boolean
  isTrending?: boolean
  isActive?: boolean
  compliance?: Compliance[]
  averageRating?: number
  reviewCount?: number
}

export interface ProductVariant {
  id: string
  name: string
  value: string
  sku?: string | null
  price?: number | null
  inventory: number
  image?: string
}

export interface Compliance {
  type: string
  status: string
  documentUrl?: string
  expiryDate?: Date
}

export interface CartItem {
  id: string
  product: Product
  quantity: number
  variant?: ProductVariant
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
  MXN: 17.15,
  BRL: 5.65,
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  MXN: 'MX$',
  BRL: 'R$',
}

export const CURRENCY_NAMES: Record<Currency, string> = {
  USD: 'US Dollar',
  MXN: 'Mexican Peso',
  BRL: 'Brazilian Real',
}

// Timezone to Currency mapping
export const TIMEZONE_CURRENCY: Record<string, Currency> = {
  'America/New_York': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Phoenix': 'USD',
  'America/Mexico_City': 'MXN',
  'America/Cancun': 'MXN',
  'America/Sao_Paulo': 'BRL',
  'America/Rio_Branco': 'BRL',
  'America/Brasilia': 'BRL',
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

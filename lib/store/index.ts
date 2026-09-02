import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Currency, Product, ProductVariant } from '@/types'
import { convertPrice } from '@/lib/utils'

interface CartState {
  items: CartItem[]
  currency: Currency
  isOpen: boolean
  addItem: (product: Product, quantity?: number, variant?: ProductVariant, warehouseId?: string, warehouseName?: string) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  setCurrency: (currency: Currency) => void
  toggleCart: () => void
  getSubtotal: () => number
  getItemCount: () => number
  getTotalWeight: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      currency: 'USD',
      isOpen: false,

      addItem: (product, quantity = 1, variant, warehouseId, warehouseName) => {
        set((state) => {
          // Find existing item with same product, variant, AND warehouse
          const existingItemIndex = state.items.findIndex(
            (item) => item.product.id === product.id && item.variant?.id === variant?.id && item.warehouseId === warehouseId
          )

          if (existingItemIndex > -1) {
            const updatedItems = [...state.items]
            updatedItems[existingItemIndex].quantity += quantity
            return { items: updatedItems, isOpen: true }
          }

          return {
            items: [
              ...state.items,
              {
                id: `${product.id}-${variant?.id || 'default'}-${warehouseId || 'default'}-${Date.now()}`,
                product,
                quantity,
                variant,
                warehouseId,
                warehouseName,
              },
            ],
            isOpen: true,
          }
        })
      },

      removeItem: (itemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
        }))
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId)
          return
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          ),
        }))
      },

      clearCart: () => set({ items: [] }),

      setCurrency: (currency) => set({ currency }),

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      getSubtotal: () => {
        const { items, currency } = get()
        return items.reduce((total, item) => {
          return total + convertPrice(item.product.price, currency) * item.quantity
        }, 0)
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0)
      },

      getTotalWeight: () => {
        const { items } = get()
        return items.reduce((total, item) => {
          const weight = item.product.weight || 0
          return total + weight * item.quantity
        }, 0)
      },
    }),
    {
      name: 'joyhub-cart',
      partialize: (state) => ({
        items: state.items,
        currency: state.currency,
      }),
    }
  )
)

// User Store
export interface SavedAddress {
  id: string
  label: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  isDefault?: boolean
}

interface UserState {
  user: { id: string; email: string; name: string; role: string } | null
  addresses: SavedAddress[]
  isAuthenticated: boolean
  login: (user: { id: string; email: string; name: string; role: string }) => void
  logout: () => void
  addAddress: (address: Omit<SavedAddress, 'id'>) => void
  updateAddress: (id: string, address: Partial<SavedAddress>) => void
  removeAddress: (id: string) => void
  setDefaultAddress: (id: string) => void
}

export const useUserStore = create<UserState>(
  persist(
    (set) => ({
      user: null,
      addresses: [],
      isAuthenticated: false,

      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false, addresses: [] }),

      addAddress: (address) =>
        set((state) => ({
          addresses: [
            ...state.addresses,
            { ...address, id: Date.now().toString() },
          ],
        })),

      updateAddress: (id, address) =>
        set((state) => ({
          addresses: state.addresses.map((a) =>
            a.id === id ? { ...a, ...address } : a
          ),
        })),

      removeAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.filter((a) => a.id !== id),
        })),

      setDefaultAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.map((a) => ({
            ...a,
            isDefault: a.id === id,
          })),
        })),
    }),
    {
      name: 'joyhub-user',
    }
  )
)

// UI Store
interface UIState {
  isMobileMenuOpen: boolean
  isSearchOpen: boolean
  isSubscribeModalOpen: boolean
  subscribeDelay: number
  mobileMenuOpen: () => void
  mobileMenuClose: () => void
  toggleSearch: () => void
  openSubscribeModal: () => void
  closeSubscribeModal: () => void
  setSubscribeDelay: (delay: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  isMobileMenuOpen: false,
  isSearchOpen: false,
  isSubscribeModalOpen: false,
  subscribeDelay: 10,

  mobileMenuOpen: () => set({ isMobileMenuOpen: true }),
  mobileMenuClose: () => set({ isMobileMenuOpen: false }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
  openSubscribeModal: () => set({ isSubscribeModalOpen: true }),
  closeSubscribeModal: () => set({ isSubscribeModalOpen: false }),
  setSubscribeDelay: (delay) => set({ subscribeDelay: delay }),
}))

// Wishlist Store
interface WishlistState {
  items: string[]
  addItem: (productId: string) => void
  removeItem: (productId: string) => void
  isInWishlist: (productId: string) => boolean
  toggleItem: (productId: string) => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId) =>
        set((state) => ({
          items: state.items.includes(productId)
            ? state.items
            : [...state.items, productId],
        })),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((id) => id !== productId),
        })),

      isInWishlist: (productId) => get().items.includes(productId),

      toggleItem: (productId) => {
        if (get().isInWishlist(productId)) {
          get().removeItem(productId)
        } else {
          get().addItem(productId)
        }
      },
    }),
    {
      name: 'joyhub-wishlist',
    }
  )
)

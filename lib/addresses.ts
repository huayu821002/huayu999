// Direct localStorage address management (bypasses Zustand persist hydration issues)

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

const ADDRESSES_KEY = 'fiestaflare-addresses'
const AUTH_KEY = 'fiestaflare-auth' // separate from Zustand's joyhub-user

export function getSavedAddresses(): SavedAddress[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ADDRESSES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveAddresses(addresses: SavedAddress[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses))
}

export function getStoredAuth(): { isAuthenticated: boolean; user: { name: string; email: string } | null } {
  if (typeof window === 'undefined') return { isAuthenticated: false, user: null }
  try {
    const raw = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    if (raw && token) {
      return { isAuthenticated: true, user: JSON.parse(raw) }
    }
  } catch {}
  return { isAuthenticated: false, user: null }
}

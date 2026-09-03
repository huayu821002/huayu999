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

export function saveAddresses(addresses: SavedAddress[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses))
}

export function getStoredAuth(): { isAuthenticated: boolean; user: { name: string; email: string } | null } {
  if (typeof window === 'undefined') {
    console.warn('[addresses] getStoredAuth: window undefined, returning false')
    return { isAuthenticated: false, user: null }
  }
  try {
    const raw = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    const joyhubUser = localStorage.getItem('joyhub-user')
    console.log('[addresses] getStoredAuth:', { rawUser: !!raw, hasToken: !!token, joyhubUser: !!joyhubUser })
    if (raw && token) {
      return { isAuthenticated: true, user: JSON.parse(raw) }
    }
  } catch (e) { console.error('[addresses] getStoredAuth error:', e) }
  return { isAuthenticated: false, user: null }
}

export function getSavedAddresses(): SavedAddress[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ADDRESSES_KEY)
    console.log('[addresses] getSavedAddresses:', ADDRESSES_KEY, '=', raw ? JSON.parse(raw) : 'EMPTY')
    return raw ? JSON.parse(raw) : []
  } catch (e) { console.error('[addresses] getSavedAddresses error:', e); return [] }
}

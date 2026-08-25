// Helper for admin API calls - automatically adds auth token
export function adminFetch(url: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  
  const headers: Record<string, string> = {
    ...(typeof options.headers === 'object' && options.headers !== null ? options.headers as Record<string, string> : {}),
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return fetch(url, {
    ...options,
    headers,
  })
}

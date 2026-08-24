import { jwtVerify, SignJWT } from 'jose'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return new TextEncoder().encode(secret)
}

export async function verifyToken(token: string): Promise<{ userId: string; email: string; role: string } | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload as { userId: string; email: string; role: string }
  } catch {
    return null
  }
}

// Check if user is admin from localStorage token
export async function checkAdmin(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  const token = localStorage.getItem('token')
  if (!token) return false

  const user = localStorage.getItem('user')
  if (!user) return false

  try {
    const userData = JSON.parse(user)
    if (userData.role !== 'ADMIN') return false

    // Verify token is still valid
    const payload = await verifyToken(token)
    return payload !== null && payload.role === 'ADMIN'
  } catch {
    return false
  }
}

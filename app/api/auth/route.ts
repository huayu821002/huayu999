import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { checkRateLimit, getClientKey } from '@/lib/rateLimit'
import { sendEmail, getEmailTemplate, interpolateTemplate } from '@/lib/email'

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export async function POST(request: Request) {
  // Rate limit by client IP
  const clientKey = getClientKey(request)
  const { allowed, remaining, retryAfterMs } = checkRateLimit(clientKey)
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  try {
    const { action, email, password, name } = await request.json()

    if (action === 'register') {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'Email already registered' },
          { status: 400 }
        )
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || email.split('@')[0],
          role: 'CUSTOMER',
        },
      })

      // Create cart for user
      await prisma.cart.create({
        data: { userId: user.id },
      })

      // Send welcome email asynchronously (non-blocking)
      sendWelcomeEmail(user.email, user.name || user.email.split('@')[0]).catch(err => {
        console.error('[Auth] Failed to send welcome email:', err)
      })

      // Generate JWT
      const token = await new SignJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('365d')
        .sign(JWT_SECRET)

      return NextResponse.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      })
    }

    if (action === 'login') {
      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        )
      }

      const isValid = await bcrypt.compare(password, user.password || "")

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        )
      }

      // Generate JWT
      const token = await new SignJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('365d')
        .sign(JWT_SECRET)

      return NextResponse.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Auth API error:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

// Send welcome email to newly registered user
async function sendWelcomeEmail(email: string, name: string) {
  try {
    const template = await getEmailTemplate(prisma, 'welcome')
    if (!template || !template.enabled) return

    const storeName = process.env.NEXT_PUBLIC_APP_NAME || 'Fiestaflare'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fiestaflare.com'

    const subject = interpolateTemplate(template.subject, {
      store_name: storeName,
      customer_name: name,
      login_url: `${appUrl}/login`,
    })

    const htmlContent = interpolateTemplate(template.body, {
      store_name: storeName,
      customer_name: name,
      login_url: `${appUrl}/login`,
    })

    await sendEmail({
      to: [{ email, name }],
      subject,
      htmlContent,
      sender: { name: storeName, email: 'noreply@fiestaflare.com' },
    })

    console.log(`[Auth] Welcome email sent to ${email}`)
  } catch (error) {
    console.error('[Auth] Failed to send welcome email:', error)
  }
}

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

    if (action === 'forgot_password') {
      const user = await prisma.user.findUnique({
        where: { email },
      })

      // Always return success to prevent email enumeration
      if (!user || !user.password) {
        return NextResponse.json({
          success: true,
          message: 'If an account exists with this email, a reset link has been sent.',
        })
      }

      // Generate reset token
      const resetToken = require('crypto').randomBytes(32).toString('hex')
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.user.update({
        where: { email },
        data: { resetToken, resetExpiry },
      })

      // Send reset email
      const storeName = process.env.NEXT_PUBLIC_APP_NAME || 'Fiestaflare'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fiestaflare.com'
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`

      sendPasswordResetEmail(email, user.name || email.split('@')[0], resetUrl, storeName).catch(err => {
        console.error('[Auth] Failed to send password reset email:', err)
      })

      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.',
      })
    }

    if (action === 'reset_password') {
      const { token, password: newPassword } = await request.json()

      if (!token || !newPassword) {
        return NextResponse.json(
          { success: false, error: 'Token and new password are required' },
          { status: 400 }
        )
      }

      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetExpiry: { gte: new Date() },
        },
      })

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired reset token' },
          { status: 400 }
        )
      }

      // Hash new password and clear reset token
      const hashedPassword = await bcrypt.hash(newPassword, 10)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetExpiry: null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Password has been reset successfully',
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

// Send password reset email
async function sendPasswordResetEmail(email: string, name: string, resetUrl: string, storeName: string) {
  try {
    const subject = `Reset Your ${storeName} Password`
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333;">${storeName}</h1>
        </div>
        <div style="background: #f9f9f9; border-radius: 10px; padding: 30px;">
          <h2 style="color: #333;">Hello ${name},</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to set a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            This link will expire in <strong>1 hour</strong>.
          </p>
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            If you didn't request a password reset, please ignore this email. This request was made by someone with access to your email address.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            ${storeName} - Your trusted online store
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: [{ email, name }],
      subject,
      htmlContent,
      sender: { name: storeName, email: 'noreply@fiestaflare.com' },
    })

    console.log(`[Auth] Password reset email sent to ${email}`)
  } catch (error) {
    console.error('[Auth] Failed to send password reset email:', error)
    throw error
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { randomBytes } from 'crypto'
import { checkRateLimit, getClientKey, checkLoginRateLimit, checkAccountRateLimit } from '@/lib/rateLimit'
import { verifyToken } from '@/lib/auth'
import { sendEmail, getEmailTemplate, interpolateTemplate } from '@/lib/email'

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

// 管理员会话 cookie 名（httpOnly），供 middleware / 服务端渲染保护后台页面使用。
// 这是契约，名字不能随便改。
const ADMIN_COOKIE = 'ff_admin_session'
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 90 // 90 天，与管理员 JWT 有效期一致

// 密码强度：至少 8 位，且同时包含字母和数字。
// 为什么不只看长度：纯字母 / 纯数字的口令在字典表和彩虹表面前几乎等于明文。
function isStrongPassword(password: unknown): boolean {
  if (typeof password !== 'string') return false
  if (password.length < 8) return false
  if (!/[A-Za-z]/.test(password)) return false
  if (!/\d/.test(password)) return false
  return true
}

// 签发 JWT：有效期按角色区分。
// 客户 7 天（够用，被盗后影响有限）；管理员 90 天
//（管理员要把 JWT 粘进 1688 采集脚本里长期跑，短有效期会天天掉线）。
async function signUserToken(user: { id: string; email: string; role: string }): Promise<string> {
  const expiration = user.role === 'ADMIN' ? '90d' : '7d'
  return new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiration)
    .sign(JWT_SECRET)
}

function publicUser(user: { id: string; email: string; name: string | null; role: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

/**
 * 在响应上挂载管理员会话 cookie。
 * 只有 role === 'ADMIN' 才会设置；客户登录时反而要把它清掉，
 * 防止「同一浏览器先登管理员再登客户」残留旧 cookie 造成越权残留。
 */
function attachAdminCookie(response: NextResponse, token: string, role: string): NextResponse {
  if (role === 'ADMIN') {
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_COOKIE_MAX_AGE,
    })
  } else {
    response.cookies.delete(ADMIN_COOKIE)
  }
  return response
}

export async function POST(request: Request) {
  // 第一层限流：IP 兜底。放在解析 body 之前 —— 否则畸形 body 的请求
  // 会因为解析抛错而完全绕过限流，可以被用来打内存/CPU。
  const clientKey = getClientKey(request)
  const ipGuard = checkRateLimit(`auth:${clientKey}`, {
    maxAttempts: 30,
    windowMs: 15 * 60 * 1000,
  })
  if (!ipGuard.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(ipGuard.retryAfterMs / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  // ★ 2026-10-30 P0 修复：请求体只能解析一次。
  //   旧代码在 POST 顶部已经 `await request.json()`，reset_password 分支又解析了一次，
  //   第二次必然抛「body used already」→ 忘记密码 / 重置密码接口 500。
  //   现在统一在这里解析一次，各分支从 body 取值。
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }

  try {
    const { action, email, password, name } = body

    if (action === 'register') {
      // 注册也要有账号维度限流：否则可以用同一个邮箱反复注册来轰炸数据库/发欢迎邮件
      const registerLimit = checkAccountRateLimit(String(email || ''), 10, 15 * 60 * 1000)
      if (!registerLimit.allowed) {
        return NextResponse.json(
          { success: false, error: 'Too many attempts. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(registerLimit.retryAfterMs / 1000)),
              'X-RateLimit-Remaining': '0',
            },
          }
        )
      }

      if (!email || typeof email !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Email is required' },
          { status: 400 }
        )
      }

      if (!isStrongPassword(password)) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 8 characters and contain both letters and numbers' },
          { status: 400 }
        )
      }

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

      // Generate JWT（有效期按角色区分）
      const token = await signUserToken(user)

      const response = NextResponse.json({
        success: true,
        data: {
          token,
          user: publicUser(user),
        },
      })
      // 管理员才设置 httpOnly 会话 cookie（客户不设置）
      return attachAdminCookie(response, token, user.role)
    }

    if (action === 'login') {
      // 登录限流改为「IP + 账号」组合（IP 可伪造，账号维度挡得住换 IP 爆破）
      const loginLimit = checkLoginRateLimit(request, String(email || ''))
      if (!loginLimit.allowed) {
        return NextResponse.json(
          { success: false, error: 'Too many attempts. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(loginLimit.retryAfterMs / 1000)),
              'X-RateLimit-Remaining': '0',
            },
          }
        )
      }

      if (!email || !password) {
        return NextResponse.json(
          { success: false, error: 'Email and password are required' },
          { status: 400 }
        )
      }

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

      // Generate JWT（有效期按角色区分）
      const token = await signUserToken(user)

      const response = NextResponse.json({
        success: true,
        data: {
          token,
          user: publicUser(user),
        },
      })
      // 管理员才设置 httpOnly 会话 cookie（客户登录会清掉旧的管理员 cookie）
      return attachAdminCookie(response, token, user.role)
    }

    if (action === 'forgot_password') {
      // 防止被用来批量轰炸邮箱（同时保留「无论账号是否存在都返回同样文案」）
      const forgotLimit = checkAccountRateLimit(String(email || ''), 5, 15 * 60 * 1000)
      if (!forgotLimit.allowed) {
        return NextResponse.json(
          { success: false, error: 'Too many attempts. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(forgotLimit.retryAfterMs / 1000)),
              'X-RateLimit-Remaining': '0',
            },
          }
        )
      }

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
      const resetToken = randomBytes(32).toString('hex')
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
      // ★ 请求体只在 POST 顶部解析过一次，这里直接用 body
      const { token: resetTokenValue, password: newPassword } = body

      if (!resetTokenValue || !newPassword) {
        return NextResponse.json(
          { success: false, error: 'Token and new password are required' },
          { status: 400 }
        )
      }

      if (!isStrongPassword(newPassword)) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 8 characters and contain both letters and numbers' },
          { status: 400 }
        )
      }

      const user = await prisma.user.findFirst({
        where: {
          resetToken: resetTokenValue,
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

    if (action === 'change_password') {
      // 管理员改自己的密码：必须带管理员 JWT（Bearer），仅限 ADMIN 角色
      const authHeader = request.headers.get('authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const payload = await verifyToken(authHeader.slice(7).trim())
      if (!payload) {
        return NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 401 }
        )
      }
      if (payload.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        )
      }

      const { currentPassword, newPassword } = body
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password and new password are required' },
          { status: 400 }
        )
      }

      if (!isStrongPassword(newPassword)) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 8 characters and contain both letters and numbers' },
          { status: 400 }
        )
      }

      const admin = await prisma.user.findUnique({
        where: { id: payload.userId },
      })
      if (!admin) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }

      const isValid = await bcrypt.compare(currentPassword, admin.password || '')
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 400 }
        )
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10)
      await prisma.user.update({
        where: { id: admin.id },
        data: {
          password: hashedPassword,
          // 改完密码必须作废重置链接，否则旧邮件里的链接还能改密码
          resetToken: null,
          resetExpiry: null,
        },
      })

      // 重新签发 token，前端可直接续期（不用重新登录）
      const token = await signUserToken(admin)
      const response = NextResponse.json({
        success: true,
        data: {
          token,
          user: publicUser(admin),
        },
      })
      return attachAdminCookie(response, token, admin.role)
    }

    if (action === 'logout') {
      // 客户端会自己清 localStorage 的 token，这里只负责清服务端 cookie
      const response = NextResponse.json({ success: true })
      response.cookies.set(ADMIN_COOKIE, '', { maxAge: 0, path: '/' })
      response.cookies.delete(ADMIN_COOKIE)
      return response
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

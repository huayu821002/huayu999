import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientKey } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    // ★ 2026-10-30 安全修复：订阅接口无限流 → 可被用来灌垃圾邮箱（发信成本 + 退信率），
    // 同一 IP 1 小时最多 10 次。
    const limit = checkRateLimit(`newsletter:${getClientKey(request)}`, {
      maxAttempts: 10,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
      )
    }

    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 })
    }

    // Check if already subscribed
    const existing = await prisma.subscriber.findUnique({
      where: { email },
    })

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json({ success: true, message: 'Already subscribed' })
      }
      // Reactivate inactive subscription
      await prisma.subscriber.update({
        where: { email },
        data: { isActive: true },
      })
      return NextResponse.json({ success: true, message: 'Subscription reactivated' })
    }

    // Create new subscription
    await prisma.subscriber.create({
      data: { email },
    })

    return NextResponse.json({ success: true, message: 'Subscribed successfully' })
  } catch (error) {
    console.error('Newsletter subscription error:', error)
    return NextResponse.json({ success: false, error: 'Failed to subscribe' }, { status: 500 })
  }
}

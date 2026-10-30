import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { checkRateLimit, getClientKey } from '@/lib/rateLimit'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    // ★ 2026-10-30 安全修复：公开表单接口无限流 → 可被用来灌垃圾线索 / 打数据库。
    // 同一 IP 15 分钟内最多 5 条。
    const limit = checkRateLimit(`contact:${getClientKey(req)}`, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions, please try again later' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
      )
    }

    const body = await req.json()
    const { name, email, phone, subject, message } = body

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      )
    }

    const contact = await prisma.contact.create({
      data: { name, email, phone: phone || '', subject: subject || '', message },
    })

    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to submit contact form' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

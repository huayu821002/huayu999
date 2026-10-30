import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'

/**
 * /api/admin/account —— 管理员自己的账号设置（改邮箱 / 改密码）
 *
 * ★ 2026-10-30 新增：
 *   之前后台**没有任何**改密码/改邮箱的入口 —— 只能靠数据库或 API 手改。
 *   现在提供自助入口，同时强制「必须先验证当前密码」，
 *   避免拿到一个后台 JWT（哪怕是别人复用/泄露的）就能把账号改掉。
 */

export const runtime = 'nodejs'

async function getAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 } as const
  }
  const payload = await verifyToken(authHeader.slice(7).trim())
  if (!payload) return { error: 'Invalid token', status: 401 } as const
  if (payload.role !== 'ADMIN') return { error: 'Forbidden', status: 403 } as const

  const admin = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, password: true },
  })
  if (!admin) return { error: 'Admin account not found', status: 404 } as const
  return { admin }
}

export async function GET(request: Request) {
  const res = await getAdmin(request)
  if ('error' in res) {
    return NextResponse.json({ success: false, error: res.error }, { status: res.status })
  }
  return NextResponse.json({
    success: true,
    data: { id: res.admin.id, email: res.admin.email, name: res.admin.name, role: res.admin.role },
  })
}

export async function PATCH(request: Request) {
  const res = await getAdmin(request)
  if ('error' in res) {
    return NextResponse.json({ success: false, error: res.error }, { status: res.status })
  }

  try {
    const body = await request.json()
    const { currentPassword, newEmail, newPassword } = body

    if (!currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password is required' },
        { status: 400 }
      )
    }

    // 必须先验证当前密码 —— 这是防止「拿到后台 token 就能改账号」的关键
    const ok = await bcrypt.compare(currentPassword, res.admin.password || '')
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    const data: { email?: string; password?: string } = {}

    if (newEmail && newEmail !== res.admin.email) {
      const email = String(newEmail).trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 })
      }
      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists && exists.id !== res.admin.id) {
        return NextResponse.json(
          { success: false, error: 'That email is already in use' },
          { status: 409 }
        )
      }
      data.email = email
    }

    if (newPassword) {
      const pwd = String(newPassword)
      // 与注册/改密同一套强度规则：≥8 位 + 字母 + 数字
      if (pwd.length < 8 || !/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 8 characters and contain both letters and numbers' },
          { status: 400 }
        )
      }
      data.password = await bcrypt.hash(pwd, 10)
    }

    if (!data.email && !data.password) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: res.admin.id },
      data,
      select: { id: true, email: true, name: true, role: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[admin/account] update error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update account' }, { status: 500 })
  }
}

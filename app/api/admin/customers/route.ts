import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ★ 2026-10-30 安全修复：这里原来直接 `findMany()` 把**整个 User 行**返回给前端，
// 其中包含 `password`（bcrypt 哈希）和 `resetToken` / `resetExpiry`（密码重置凭据）。
// 前端后台只需要基础资料字段 —— 敏感字段一律在服务端剔除，不进 JSON。
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search,  } },
        { email: { contains: search,  } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error('Admin customers GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch customers' }, { status: 500 })
  }
}

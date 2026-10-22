import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const KEY = process.env.DEBUG_1688_KEY || '***REMOVED_1688_DEBUG_KEY***'

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const limit = Math.min(Number(url.searchParams.get('limit') || 5), 20)

  // 调整用户角色：?setrole=<email>&role=<ROLE>
  const setEmail = url.searchParams.get('setrole')
  if (setEmail) {
    const role = url.searchParams.get('role') || 'ADMIN'
    const u = await prisma.user.updateMany({ where: { email: setEmail }, data: { role } })
    return NextResponse.json({ updated: u.count, email: setEmail, role })
  }

  // 查用户角色（诊断鉴权问题）
  if (url.searchParams.get('users')) {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true },
      take: 20,
    })
    return NextResponse.json({ users })
  }

  // 清理测试脏数据：?del=<sourceId>
  const del = url.searchParams.get('del')
  if (del) {
    const r = await prisma.supplierProduct.deleteMany({ where: { sourceId: del } })
    return NextResponse.json({ deleted: r.count, sourceId: del })
  }

  const rows = await prisma.supplierProduct.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json({
    count: rows.length,
    rows: rows.map((r: any) => ({
      id: r.id,
      sourceId: r.sourceId,
      title: r.title,
      priceMin: r.priceMin,
      priceMax: r.priceMax,
      moq: r.moq,
      imagesCount: (() => { try { return JSON.parse(r.images || '[]').length } catch { return -1 } })(),
      images: (() => { try { return JSON.parse(r.images || '[]') } catch { return r.images } })(),
      status: r.status,
      raw: r.raw,
    })),
  })
}

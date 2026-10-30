import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminRequest } from '@/lib/chatAuth'

// ★ 2026-10-29：key **只从环境变量读**，没有硬编码回落。
//   原因：硬编码 key 曾提交进公开仓库（已在 git 历史里抹掉），
//   现在必须「env 没配 = 端点直接关闭」，绝不能有回落默认值。
const KEY = process.env.DEBUG_1688_KEY

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  if (!KEY || url.searchParams.get('key') !== KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const limit = Math.min(Number(url.searchParams.get('limit') || 5), 20)

  // ★ 2026-10-30 安全修复：写操作（提权 / 删数据）额外必须携带管理员 JWT。
  //   原因：DEBUG_1688_KEY 一旦泄漏（浏览器历史、日志、截图），
  //   拿着它就能把任意账号提成 ADMIN 或删库 —— 写操作必须是第二道独立凭证。
  //   读操作仍只需 DEBUG_1688_KEY（保持诊断脚本的现有工作流不变）。
  const isWrite = url.searchParams.get('setrole') || url.searchParams.get('del')
  if (isWrite && !(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'admin token required' }, { status: 403 })
  }

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
      // ★ 2026-10-28：变体明细单独存在列里（不在 raw 内）→ 必须单独返回，
      //   否则只能看到诊断字段、看不到每个变体的真实价格。
      variants: r.variants,
      variantDims: r.variantDims,
    })),
  })
}

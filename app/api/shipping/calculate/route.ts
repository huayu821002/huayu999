import { NextResponse } from 'next/server'
import { calculateShippingOptions } from '@/lib/shipping'
import { checkRateLimit, getClientKey } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    // ★ 2026-10-30 安全修复：运费试算接口是公开的且会查库，
    // 不限流就能被拿来当压测器（每次都跑一遍运费计算 + 查仓库/费率表）。
    // 同一 IP 每分钟最多 60 次（正常用户切国家/改数量会连打几次）。
    const limit = checkRateLimit(`shipcalc:${getClientKey(request)}`, {
      maxAttempts: 60,
      windowMs: 60 * 1000,
    })
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
      )
    }

    const body = await request.json()
    const { subtotal, weight, country, warehouseId } = body

    const subtotalNum = parseFloat(subtotal) || 0
    const weightNum = parseFloat(weight) || 0

    const options = await calculateShippingOptions(country, weightNum, subtotalNum, warehouseId)

    return NextResponse.json({ success: true, data: options })
  } catch (error: any) {
    console.error('[/api/shipping/calculate] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to calculate shipping' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { upsertSupplierProduct, ensureSupplierProductTable } from '@/lib/supplier'
import { isAdminRequest } from '@/lib/chatAuth'

/**
 * POST /api/import/1688
 * 接收采集到的商品数据（油猴脚本 / 采集器 / 控制台脚本推送）。
 *
 * 放在 /api/admin 之外是有意的：采集脚本运行在 1688 域名下，属于跨域请求，
 * 预检(OPTIONS)不能被中间件的 JWT 校验拦住，所以鉴权放在这里自己做。
 */

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-import-key',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || '*'
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-import-key',
    'Vary': 'Origin',
  }

  try {
    // 鉴权：管理员 JWT（Authorization: Bearer xxx）
    if (!(await isAdminRequest(request))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: cors }
      )
    }

    const body = await request.json()
    let items: any[] = []
    if (Array.isArray(body?.items)) {
      items = body.items
    } else if (body?.data) {
      items = Array.isArray(body.data) ? body.data : [body.data]
    } else if (body && (body.sourceId || body.offerId)) {
      // 直接粘贴的单条商品 JSON
      items = [body]
    }

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data provided. Send { data: {...} } or { items: [...] } or a single product object' },
        { status: 400, headers: cors }
      )
    }

    await ensureSupplierProductTable()

    const results: any[] = []
    const errors: any[] = []

    for (const item of items) {
      try {
        const sourceId = item?.sourceId || item?.offerId || item?.id
        if (!sourceId) throw new Error('missing sourceId / offerId')

        const record = await upsertSupplierProduct({
          source: item?.source || '1688',
          sourceId: String(sourceId),
          sourceUrl: item?.sourceUrl || item?.url,
          title: item?.title || item?.name || '',
          titleCn: item?.titleCn,
          description: item?.description,
          images: item?.images,
          videoUrl: item?.videoUrl,
          priceMin: numberOrNull(item?.priceMin),
          priceMax: numberOrNull(item?.priceMax),
          moq: numberOrNull(item?.moq),
          unit: item?.unit,
          skuText: item?.skuText,
          attributes: item?.attributes,
          supplierName: item?.supplierName,
          supplierUrl: item?.supplierUrl,
          shippingText: item?.shippingText,
          raw: item?.raw || item,
        })
        results.push({ id: record.id, sourceId: record.sourceId, status: record.status })
      } catch (e: any) {
        errors.push({ sourceId: item?.sourceId, error: e?.message || String(e) })
      }
    }

    return NextResponse.json(
      { success: true, imported: results.length, failed: errors.length, results, errors },
      { status: 200, headers: cors }
    )
  } catch (error: any) {
    console.error('1688 import error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Import failed' },
      { status: 500, headers: cors }
    )
  }
}

function numberOrNull(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

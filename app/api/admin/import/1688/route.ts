import { NextRequest, NextResponse } from 'next/server'
import { upsertSupplierProduct, ensureSupplierProductTable } from '@/lib/supplier'

/**
 * POST /api/admin/import/1688
 * 接收采集到的商品数据（油猴脚本 / 采集器推送）。
 * 鉴权：中间件已校验 Authorization Bearer 的 role=ADMIN。
 * 支持单条 { data: {...} } 或批量 { items: [...] }
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
  try {
    const body = await request.json()
    const items: any[] = Array.isArray(body?.items)
      ? body.items
      : body?.data
        ? [body.data]
        : []

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data provided. Send { data: {...} } or { items: [...] }' },
        { status: 400 }
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
      { status: 200 }
    )
  } catch (error: any) {
    console.error('1688 import error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Import failed' },
      { status: 500 }
    )
  }
}

function numberOrNull(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

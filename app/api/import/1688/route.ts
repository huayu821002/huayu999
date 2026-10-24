import { NextRequest, NextResponse } from 'next/server'
import { upsertSupplierProduct, ensureSupplierProductTable, scrubStoredRawPII } from '@/lib/supplier'
import { isAdminRequest, describeAuth } from '@/lib/chatAuth'
import { scrubPIIItem } from '@/lib/pii'

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
      'X-FF-Origin': 'app',
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
    // 标记：这个响应确实来自本应用。
    // 采集脚本据此区分「应用层返回的 401/403」和「Hostinger 边缘层返回的 403」——
    // 边缘层不会带这个头，诊断时一眼就能看出来。
    'X-FF-Origin': 'app',
  }

  try {
    // 鉴权：管理员 JWT（Authorization: Bearer xxx）
    if (!(await isAdminRequest(request))) {
      const info = await describeAuth(request)
      return NextResponse.json(
        { success: false, error: 'Unauthorized', reason: info.reason, role: info.role || null },
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
    // 一次性清洗历史存量里的个人信息（幂等，每进程只跑一次，失败不影响主流程）
    await scrubStoredRawPII()

    const results: any[] = []
    const errors: any[] = []

    for (const item of items) {
      try {
        // 隐私兜底：即使旧版采集器还在发带个人信息的内容，也不入库。
        // （2026-10-24：1688 详情页会同时拉取收货地址簿接口，
        //   里面有用户的真实姓名、手机号、收货地址。）
        const safeItem = scrubPIIItem(item)
        const sourceId = safeItem?.sourceId || safeItem?.offerId || safeItem?.id
        if (!sourceId) throw new Error('missing sourceId / offerId')

        const record = await upsertSupplierProduct({
          source: safeItem?.source || '1688',
          sourceId: String(sourceId),
          sourceUrl: safeItem?.sourceUrl || safeItem?.url,
          title: safeItem?.title || safeItem?.name || '',
          titleCn: safeItem?.titleCn,
          titleEn: safeItem?.titleEn,
          seoTitle: safeItem?.seoTitle,
          keywords: safeItem?.keywords,
          shortDescEn: safeItem?.shortDescEn,
          descriptionEn: safeItem?.descriptionEn,
          firstSku: safeItem?.firstSku,
          sourceSkuId: safeItem?.sourceSkuId,
          wholesalePrice: numberOrNull(safeItem?.wholesalePrice),
          priceLadder: safeItem?.priceLadder,
          skuPrices: Array.isArray(safeItem?.skuPrices) ? JSON.stringify(safeItem.skuPrices) : safeItem?.skuPrices,
          description: safeItem?.description,
          images: (() => {
            const imgs = Array.isArray(safeItem?.images) ? safeItem.images.filter(Boolean) : []
            const main = safeItem?.mainImage
            if (main && imgs.includes(main)) return [main, ...imgs.filter((u: string) => u !== main)]
            if (main) return [main, ...imgs]
            return imgs
          })(),
          videoUrl: safeItem?.videoUrl,
          priceMin: numberOrNull(safeItem?.priceMin),
          priceMax: numberOrNull(safeItem?.priceMax),
          moq: numberOrNull(safeItem?.moq),
          unit: safeItem?.unit,
          skuText: safeItem?.skuText,
          attributes: safeItem?.attributes,
          supplierName: safeItem?.supplierName,
          supplierUrl: safeItem?.supplierUrl,
          shippingText: safeItem?.shippingText,
          raw: safeItem?.raw || safeItem,
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



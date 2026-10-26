import { NextRequest, NextResponse } from 'next/server'
import { normalizeAlibabaImage, normalizeAlibabaImageList } from '@/lib/imageNormalize'
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
            // 图集上限 5 张（主图 1 张 + 图集共 5 张），主图必须在首位
            // ★ 先归一化成原图（剥掉 _sum 等缩略后缀，80x80 → 800x800）
            const imgs = normalizeAlibabaImageList(
              Array.isArray(safeItem?.images) ? safeItem.images.filter(Boolean) : []
            )
            const main = normalizeAlibabaImage(safeItem?.mainImage)
            let out: string[]
            if (main && imgs.includes(main)) out = [main, ...imgs.filter((u: string) => u !== main)]
            else if (main) out = [main, ...imgs]
            else out = [...imgs]
            // 去重（归一化后可能有重复）
            out = Array.from(new Set(out))
            return out.slice(0, 5)
          })(),
          videoUrl: safeItem?.videoUrl,
          priceMin: numberOrNull(safeItem?.priceMin),
          priceMax: numberOrNull(safeItem?.priceMax),
          moq: numberOrNull(safeItem?.moq),
          unit: safeItem?.unit,
          skuText: safeItem?.skuText,
          attributes: safeItem?.attributes,
          variants: sanitizeVariants(safeItem?.variants),
          variantDims: sanitizeVariantDims(safeItem?.variantDims),
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

/**
 * 清洗变体明细。
 *
 * 只保留后台真正用得到的字段，避免把采集端的调试残留写进库：
 *   skuId / specs / color / size / specText / price / priceText / image
 * 并且限长（200 个变体足够），防止异常报文把库撑爆。
 */
function sanitizeVariants(input: any): any[] | undefined {
  if (!Array.isArray(input) || !input.length) return undefined
  const out: any[] = []
  for (const v of input.slice(0, 200)) {
    if (!v || typeof v !== 'object') continue
    const specs = Array.isArray(v.specs)
      ? v.specs
          .filter((s: any) => s && typeof s === 'object' && s.name && s.value)
          .slice(0, 6)
          .map((s: any) => ({ name: String(s.name).slice(0, 30), value: String(s.value).slice(0, 60) }))
      : []
    const price = numberOrNull(v.price)
    if (price === null && !specs.length) continue
    out.push({
      skuId: v.skuId ? String(v.skuId).slice(0, 64) : '',
      specs,
      color: v.color ? String(v.color).slice(0, 40) : '',
      size: v.size ? String(v.size).slice(0, 40) : '',
      specText: v.specText ? String(v.specText).slice(0, 120) : specs.map((s: any) => s.value).join(' / '),
      price,
      priceText: v.priceText ? String(v.priceText).slice(0, 40) : '',
      // ★ 变体图也要原图（_sum → 80x80 小图）
      image: v.image ? normalizeAlibabaImage(v.image).slice(0, 500) : '',
      // 配图来源：probe=用户点击探测 / none=没配上
      // （'align' 序号对齐已于 2026-10-26 移除 —— 用户要求「没点过的不要出来」，
      //   这里保留兼容：万一旧版采集器还在上报 align，也能正常入库不报错）
      imageSource: v.imageSource === 'probe' || v.imageSource === 'align' || v.imageSource === 'none'
        ? v.imageSource
        : undefined,
    })
  }
  return out.length ? out : undefined
}

/** 清洗变体维度定义 */
function sanitizeVariantDims(input: any): any[] | undefined {
  if (!Array.isArray(input) || !input.length) return undefined
  const out: any[] = []
  for (const d of input.slice(0, 10)) {
    if (!d || typeof d !== 'object') continue
    const name = d.name ? String(d.name).slice(0, 30) : ''
    if (!name) continue
    const values = Array.isArray(d.values)
      ? d.values.map((x: any) => String(x).slice(0, 60)).slice(0, 100)
      : []
    const kind = d.kind === 'color' || d.kind === 'size' ? d.kind : 'custom'
    out.push({ name, kind, values })
  }
  return out.length ? out : undefined
}



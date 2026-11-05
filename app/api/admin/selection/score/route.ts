import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, isAuthError } from '@/lib/apiAuth'
import { ensureSupplierProductTable, parseJsonField } from '@/lib/supplier'
import { scoreSupply, scoreProfit, composeScore, PLATFORM } from '@/lib/selection/scoring'
import { aiChat, aiVision, extractJson, extractImageUrls, MODELS } from '@/lib/selection/ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/admin/selection/score
 *
 * 选品 Agent —— 对候选商品批量打分，输出选品清单。
 *
 * body:
 *   {
 *     "ids": ["id1","id2"],            // 可选，不传=取最近 N 条
 *     "limit": 30,
 *     "top": 20,
 *     "model": "MiniMax-M3",
 *     "withVision": true,              // 是否拉图让 AI 看图
 *     "categoryHint": "帽子"
 *   }
 *
 * 返回：{ success, summary, selected[], rejected[] }
 */

const JUDGE_SYSTEM = `你是跨境/国内电商的资深选品总监，专精服饰配件（帽子、围巾、手套）供应链。
你的判断必须基于看到的主图和商品信息，给出可执行结论，不要空话。

评分标准（0-10 分，5 分为中位，**必须拉开区分度，不要都给 5-7**）：
- demand 需求分：款式是否好卖、是否踩中当季趋势、是否适合短视频/直播展示、是否有明确人群（男士/女士/情侣/儿童/送礼）
  → 冷门/普通通货给 3-4；普通款给 5-6；有明确趋势或强痛点给 7-8；强爆款潜质给 9+
- competition 竞争分：是否已经红海（分越高越红海、越难做）。同类目同质化严重、无差异化的给 8-9；有明显差异化或稀缺供给的给 3-5
- bundle 套装潜力：是否能与同款帽/围巾/手套组成同色系套装（0 = 完全不能成套，10 = 极易成套且颜色百搭）
  → 没有配套色的给 0-3；能凑出同色但款式风格差异大的给 4-6；颜色/材质/风格天然成套的给 7-9

判分时请先在心里对比：这几个候选里哪个最好、哪个最平庸，**相对排序必须体现出来**。

★ 另外必须给出**市场零售价**和**建议包装件数**（这两个直接影响能不能赚钱，规则引擎会用它们算净利）：
- sellPrice：这件商品在**目标市场**（跨境看 Temu/Amazon/AliExpress 同类成交价，国内看 1688/拼多多）真实能卖到的**单笔订单价**（美元/人民币均可，但要考虑运费，不要用国内单件零售价）
  → 例：1688 进价 0.36 元的发夹，实际在 Temu 上是 20 个装卖 $2.99，sellPrice 应填约 20 元（整包价），而不是 1 元
- pack：建议一次卖几件（1 = 单件卖；低价小件应该按包卖才能摊薄运费，发饰类常 10-20 件/包，服饰配件一般 1-3 件）
  → 必须结合品类：帽子/围巾/手套/袜子本身单件卖，pack=1；发夹/发圈/小挂件这类应 pack=10~20

严格只输出 JSON 对象，不要任何解释文字、不要 markdown 代码块标记、不要思考过程。
输出形如：{"demand": 7, "competition": 6, "bundle": 3, "sellPrice": 25.9, "pack": 1, "category": "发夹", "reasons": ["理由1"], "risks": ["风险1"]}
字段含义：demand=需求分(0-10，越高越好卖)、competition=竞争分(0-10，越高越红海)、bundle=套装潜力(0-10，越高越容易同色成套)
sellPrice=建议单笔订单零售价(数字)、pack=建议包装件数(整数)、category=商品品类（如 帽子/围巾/手套/发夹/发圈）
reasons 最多 3 条，risks 最多 2 条，每条不超过 20 字。`

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (isAuthError(auth)) return auth

    await ensureSupplierProductTable()

    const body = await request.json().catch(() => ({}))
    const limit = Math.min(100, Math.max(1, Number(body?.limit) || 20))
    const top = Math.min(100, Math.max(1, Number(body?.top) || 20))
    const model = body?.model || MODELS.main
    const withVision = body?.withVision !== false
    const maxImages = Math.min(3, Math.max(0, Number(body?.maxImages ?? 2)))

    // 取候选
    const where: any = {}
    if (Array.isArray(body?.ids) && body.ids.length) {
      where.id = { in: body.ids.map(String) }
    } else {
      where.status = { in: ['pending', 'collected', 'new'] }
    }
    const items = await prisma.supplierProduct.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    if (!items.length) {
      return NextResponse.json({
        success: true,
        summary: { total: 0, passed: 0, rejected: 0, selected: 0 },
        selected: [],
        rejected: [],
        message: '没有待评的候选商品（先在浏览器端跑采集器推数据到「待选品」队列）',
      })
    }

    const judged = await Promise.all(
      items.map(async (it: any) => {
        const variants = parseJsonField<any[]>(it.variants) || []
        const variantCount = Array.isArray(variants)
          ? variants.length || (parseJsonField<any[]>(it.variantDims) || []).reduce((n, d) => n + (d?.values?.length || 0), 0)
          : 0
        const imgsRaw = parseJsonField<string[]>(it.images) || []
        // ★ 必须解包站内代理相对路径，否则模型拿不到图，会静默退化成纯文本打分
        const images = extractImageUrls(it.images).filter((u) =>
          /alicdn\.com|1688\.com|aliyuncs\.com/.test(u)
        )

        const cand = {
          id: it.id,
          title: it.titleCn || it.title,
          url: it.sourceUrl || undefined,
          cost: it.priceMin ?? it.wholesalePrice ?? undefined,
          moq: it.moq ?? undefined,
          supplier: it.supplierName || undefined,
          variantCount,
          images,
          description: it.description || undefined,
          category: body?.categoryHint || undefined,
        }

        const supply = scoreSupply(cand)

        // AI 先判：它会给出市场零售价、包装件数和品类，规则再据此算钱
        // （顺序很关键：先按规则倍数算再让 AI 看，等于让 AI 去猜已经算错的钱）
        const ai = await judgeOne(cand, images, model, withVision, maxImages)
        // AI 识别的品类比用户填的 categoryHint 准（用户可能不填）
        if (ai.category) cand.category = ai.category
        const profit = scoreProfit(cand, ai.sellPrice, ai.pack)
        const rule = {
          supply: supply.score,
          profit: profit.score,
          economics: profit.economics,
          risks: [...supply.risks, ...profit.risks],
          hardFail: profit.hardFail,
        }

        const total = composeScore(cand, ai, rule)

        return {
          id: it.id,
          title: cand.title,
          url: cand.url,
          supplier: cand.supplier,
          sourceId: it.sourceId,
          images: images.slice(0, 3),
          scores: {
            demand: total.demand,
            competition: total.competition,
            supply: total.supply,
            profit: total.profit,
            bundle: total.bundle,
            total: total.total,
          },
          economics: rule.economics,
          risks: total.risks,
          hardFail: total.hardFail,
          reasons: total.reasons,
          verdict: total.hardFail ? '否决' : total.total >= 7.5 ? '强推' : total.total >= 6 ? '可上' : '观察',
        }
      })
    )

    judged.sort((a: any, b: any) => b.scores.total - a.scores.total)
    const passed = judged.filter((x: any) => !x.hardFail)
    const rejected = judged.filter((x: any) => !!x.hardFail)

    return NextResponse.json({
      success: true,
      summary: {
        total: judged.length,
        passed: passed.length,
        rejected: rejected.length,
        selected: Math.min(top, passed.length),
        model,
      },
      platform: PLATFORM,
      selected: passed.slice(0, top),
      rejected,
    })
  } catch (error: any) {
    console.error('selection score error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to score' }, { status: 500 })
  }
}

async function judgeOne(
  c: any,
  images: string[],
  model: string,
  withVision: boolean,
  maxImages: number
): Promise<{
  demand: number
  competition: number
  bundle: number
  sellPrice?: number
  pack?: number
  category?: string
  reasons: string[]
  risks: string[]
}> {
  const prompt = [
    `商品：${c.title}`,
    c.supplier ? `供应商：${c.supplier}` : '',
    `采购价：${c.cost ?? '未知'} 元/件｜起批量：${c.moq ?? '未知'}｜变体数：${c.variantCount ?? '未知'}`,
    c.description ? `描述：${c.description.slice(0, 300)}` : '',
    '请给出：需求分/竞争分/套装分 + 市场零售价 sellPrice + 建议包装件数 pack。',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    let raw: string
    const usable = withVision && maxImages > 0 ? images.slice(0, maxImages) : []
    if (usable.length) {
      const content: any[] = []
      for (const url of usable) {
        content.push({ type: 'image_url', image_url: { url } })
      }
      content.push({ type: 'text', text: prompt + '\n\n请综合图片和上述信息打分。' })
      raw = await aiChat(
        [
          { role: 'system', content: JUDGE_SYSTEM },
          { role: 'user', content },
        ],
        { model, maxTokens: 900, temperature: 0.25 }
      )
    } else {
      raw = await aiChat(
        [
          { role: 'system', content: JUDGE_SYSTEM },
          { role: 'user', content: prompt + '\n\n（没有可用图片，仅凭标题和参数判断）' },
        ],
        { model, maxTokens: 900, temperature: 0.25 }
      )
    }
    const j = extractJson<any>(raw)
    const cl = (v: any) => Math.max(0, Math.min(10, Number(v) || 0))
    const sp = Number(j.sellPrice)
    const pk = Math.round(Number(j.pack))
    return {
      demand: cl(j.demand ?? 5),
      competition: cl(j.competition ?? 6),
      bundle: cl(j.bundle ?? 0),
      sellPrice: Number.isFinite(sp) && sp > 0 ? sp : undefined,
      pack: Number.isFinite(pk) && pk >= 1 ? pk : undefined,
      category: typeof j.category === 'string' && j.category.trim() ? j.category.trim().slice(0, 20) : undefined,
      reasons: Array.isArray(j.reasons) ? j.reasons.map(String).slice(0, 5) : [],
      risks: Array.isArray(j.risks) ? j.risks.map(String).slice(0, 5) : [],
    }
  } catch (e: any) {
    console.warn('AI judge failed:', String(e).slice(0, 150))
    return {
      demand: 5, competition: 6, bundle: 0, sellPrice: undefined, pack: undefined, category: undefined,
      reasons: [], risks: ['AI 判断失败，用保守默认分'],
    }
  }
}

/**
 * 选品 Agent —— 主流程
 *
 * 用法：
 *   node --experimental-strip-types scripts/selection-agent/run.ts \
 *     --input candidates.json --out report.json --top 20
 *
 * 或走 npm script（见 package.json）：
 *   npm run selection:score -- --input candidates.json
 *
 * 输入格式（candidates.json）：
 *   [{ id, title, url, cost, moq, supplier, variantCount, images[], description, category }]
 *
 * 流程：
 *   1. 规则打分（供给分 + 利润分）—— 零成本、确定性
 *   2. 拉图（1688 CDN 无 Referer 直连即可，200）
 *   3. AI 视觉判断（需求分 / 竞争分 / 套装潜力）—— MiniMax-M3
 *   4. 合成总分 + 红线过滤 + 输出选品清单
 */

import fs from 'node:fs'
import path from 'node:path'
import { aiChat, aiVision, extractJson, MODELS, getProvider } from '../../lib/selection/ai.ts'
import {
  scoreSupply,
  scoreProfit,
  composeScore,
  round2,
  clamp,
  PLATFORM,
} from '../../lib/selection/scoring.ts'
import type { Candidate } from '../../lib/selection/scoring.ts'

/* -------------------------------------------------------------- 参数解析 */

function parseArgs(argv: string[]) {
  const out: any = { top: 20, model: MODELS.main, concurrency: 3, maxImages: 3 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input' || a === '-i') out.input = argv[++i]
    else if (a === '--out' || a === '-o') out.output = argv[++i]
    else if (a === '--top') out.top = parseInt(argv[++i]) || 20
    else if (a === '--model') out.model = argv[++i]
    else if (a === '--concurrency') out.concurrency = parseInt(argv[++i]) || 3
    else if (a === '--max-images') out.maxImages = parseInt(argv[++i]) || 3
    else if (a === '--dry-run') out.dryRun = true
  }
  return out
}

/* -------------------------------------------------------------- 图片抓取 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/**
 * 抓图片转 base64。
 * 注意：1688 CDN（cbu01.alicdn.com）有防盗链 —— 带外站 Referer 会 403，
 * 不带 Referer 直接 curl 反而是 200。所以这里刻意不发 Referer。
 */
async function fetchImageB64(url: string, timeoutMs = 20000): Promise<{ b64: string; mime: string } | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || 'image/jpeg'
    if (!ct.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 4 * 1024 * 1024) return null
    const mime = ct.includes('png') ? 'image/png' : ct.includes('webp') ? 'image/webp' : 'image/jpeg'
    return { b64: buf.toString('base64'), mime }
  } catch {
    return null
  }
}

/* -------------------------------------------------------------- AI 提示词 */

const JUDGE_SYSTEM = `你是跨境/国内电商的资深选品总监，专精服饰配件（帽子、围巾、手套）供应链。
你的判断必须基于看到的主图和商品信息，给出可执行结论，不要空话。

评分标准（0-10 分，5 分为中位，**必须拉开区分度，不要都给 5-7**）：
- demand 需求分：款式是否好卖、是否踩中当季趋势、是否适合短视频/直播展示、是否有明确人群（男士/女士/情侣/儿童/送礼）
  → 冷门/普通通货给 3-4；普通款给 5-6；有明确趋势或强痛点给 7-8；强爆款潜质给 9+
- competition 竞争分：是否已经红海（分越高越红海、越难做）。同类目同质化严重、无差异化的给 8-9；有明显差异化或稀缺供给的给 3-5
- bundle 套装潜力：是否能与同款帽/围巾/手套组成同色系套装（0 = 完全不能成套，10 = 极易成套且颜色百搭）
  → 没有配套色的给 0-3；能凑出同色但款式风格差异大的给 4-6；颜色/材质/风格天然成套的给 7-9

判分时请先在心里对比：这几个候选里哪个最好、哪个最平庸，**相对排序必须体现出来**。

严格只输出 JSON 对象，不要任何解释文字、不要 markdown 代码块标记、不要思考过程。
输出形如：{"demand": 7, "competition": 6, "bundle": 3, "reasons": ["理由1"], "risks": ["风险1"]}
字段含义：demand=需求分(0-10，越高越好卖)、competition=竞争分(0-10，越高越红海)、bundle=套装潜力(0-10，越高越容易同色成套)
reasons 最多 3 条，risks 最多 2 条，每条不超过 20 字。`

function buildJudgePrompt(c: Candidate, econ: any) {
  const imgs = (c.images || []).slice(0, 3).join('\n')
  return `商品：${c.title}
${c.supplier ? `供应商：${c.supplier}\n` : ''}${c.category ? `品类：${c.category}\n` : ''}采购价：${c.cost ?? '未知'} 元｜起批量：${c.moq ?? '未知'}｜变体数：${c.variantCount ?? '未知'}
建议零售价：${econ.sellPrice} 元｜预估单件净利：${econ.net} 元（净利率 ${econ.margin}%）
${c.description ? `描述：${c.description.slice(0, 300)}\n` : ''}图片地址：
${imgs}

请综合图片和上述信息打分。`
}

/** 套装矩阵：判断两两能否成套 */
function buildBundlePrompt(items: Candidate[]) {
  const lines = items
    .map((c, i) => `${i}. [${c.category || '未分类'}] ${c.title} | 价 ${c.cost ?? '?'}`)
    .join('\n')
  return `下面是候选商品清单（帽/围巾/手套）。请找出可以组成同色系套装的最优组合。

${lines}

对每个候选给出 0-10 的"套装潜力分"（能否与清单中其它商品配成同色/同风格套装）。
严格只输出 JSON：
{"scores": [{"index": 0, "bundle": 7, "color": "黑色", "pairs": ["1","3"], "note": "可与深灰围巾成套"}], "matrix": "配色说明"}`
}

/* -------------------------------------------------------------- 并发控制 */

async function pool<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) break
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

/* -------------------------------------------------------------- 主流程 */

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.input) {
    console.error('用法: node --experimental-strip-types scripts/selection-agent/run.ts --input candidates.json [--out report.json] [--top 20]')
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(args.input, 'utf8'))
  const candidates: Candidate[] = Array.isArray(raw) ? raw : raw.candidates || []
  console.log(`📥 读入候选 ${candidates.length} 个`)

  const provider = getProvider()
  console.log(`🤖 AI 通道：${provider.name}｜模型：${args.model}`)

  /* Step 1: 规则打分 */
  const ruleResults = candidates.map((c) => {
    const supply = scoreSupply(c)
    const profit = scoreProfit(c)
    return {
      c,
      supply,
      profit,
      rule: {
        supply: supply.score,
        profit: profit.score,
        economics: profit.economics,
        risks: [...supply.risks, ...profit.risks],
        hardFail: profit.hardFail,
      },
    }
  })
  console.log('📊 规则打分完成（供给分/利润分）')

  if (args.dryRun) {
    const out = ruleResults.map((r) => ({
      title: r.c.title,
      supply: r.rule.supply,
      profit: r.rule.profit,
      net: r.rule.economics.net,
      margin: r.rule.economics.margin,
      hardFail: r.rule.hardFail,
    }))
    console.log(JSON.stringify(out, null, 2))
    return
  }

  /* Step 2+3: 抓图 + AI 视觉判断 */
  console.log('🖼️  抓图并调用 AI 视觉判断…')
  let done = 0
  const judged = await pool(ruleResults, args.concurrency, async (r) => {
    const imgs: Array<{ b64: string; mime: string }> = []
    for (const url of (r.c.images || []).slice(0, args.maxImages)) {
      const got = await fetchImageB64(url)
      if (got) imgs.push(got)
    }
    if (!imgs.length) {
      const txt = await aiChat(
        [
          { role: 'system', content: JUDGE_SYSTEM },
          { role: 'user', content: buildJudgePrompt(r.c, r.rule.economics) + '\n（本次没有可用图片，仅凭标题和参数判断）' },
        ],
        { model: args.model, maxTokens: 900, temperature: 0.25 }
      )
      const j = safeParse(txt)
      done++
      console.log(`  [${done}/${ruleResults.length}] ⚠️ 无图，纯文本判断：${r.c.title.slice(0, 30)} → 需求${j.demand} 竞争${j.competition}`)
      return { ...r, ai: j, imageCount: 0 }
    }

    const txt = await aiVision(
      buildJudgePrompt(r.c, r.rule.economics),
      imgs.map((i) => ({ b64: i.b64, mime: i.mime })),
      { model: args.model, maxTokens: 900, temperature: 0.25, system: JUDGE_SYSTEM }
    )
    const j = safeParse(txt)
    done++
    console.log(`  [${done}/${ruleResults.length}] ✅ ${r.c.title.slice(0, 30)} → 需求${j.demand} 竞争${j.competition} 套装${j.bundle} (${imgs.length}图)`)
    return { ...r, ai: j, imageCount: imgs.length }
  })

  /* Step 4: 合成 */
  const scored = judged.map((r) => {
    const total = composeScore(r.c, r.ai, r.rule)
    return {
      id: r.c.id,
      title: r.c.title,
      url: r.c.url,
      supplier: r.c.supplier,
      category: r.c.category,
      images: (r.c.images || []).slice(0, 3),
      scores: {
        demand: total.demand,
        competition: total.competition,
        supply: total.supply,
        profit: total.profit,
        bundle: total.bundle,
        total: total.total,
      },
      economics: r.rule.economics,
      risks: total.risks,
      hardFail: total.hardFail,
      reasons: total.reasons,
      verdict: total.hardFail ? '否决' : total.total >= 7.5 ? '强推' : total.total >= 6 ? '可上' : '观察',
    }
  })

  scored.sort((a, b) => b.scores.total - a.scores.total)

  const pass = scored.filter((s) => !s.hardFail)
  const rejected = scored.filter((s) => s.hardFail)
  const selected = pass.slice(0, args.top)

  const report = {
    generatedAt: new Date().toISOString(),
    aiProvider: provider.name,
    model: args.model,
    platform: PLATFORM,
    summary: {
      total: scored.length,
      passed: pass.length,
      rejected: rejected.length,
      selected: selected.length,
      avgScore: round2(scored.reduce((s, x) => s + x.scores.total, 0) / (scored.length || 1)),
    },
    selected,
    rejected,
  }

  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true })
    fs.writeFileSync(args.output, JSON.stringify(report, null, 2))
    console.log(`\n💾 报告已写入 ${args.output}`)
  }

  console.log('\n===== 选品清单 =====')
  for (const s of selected) {
    console.log(
      `${String(s.scores.total).padStart(5)}  ${s.verdict}  ${s.title.slice(0, 42).padEnd(44)} ` +
        `需${s.scores.demand} 竞${s.scores.competition} 供${s.scores.supply} 利${s.scores.profit} ` +
        `套${s.scores.bundle} | 净利${s.economics.net}元`
    )
  }
  if (rejected.length) {
    console.log('\n===== 否决 =====')
    for (const s of rejected) console.log(`${String(s.scores.total).padStart(5)}  ${s.title.slice(0, 42)} → ${s.hardFail}`)
  }
}

function safeParse(txt: string): {
  demand: number
  competition: number
  bundle: number
  reasons: string[]
  risks: string[]
} {
  try {
    const j = extractJson<any>(txt)
    return {
      demand: clamp(Number(j.demand ?? 5), 0, 10),
      competition: clamp(Number(j.competition ?? 5), 0, 10),
      bundle: clamp(Number(j.bundle ?? 0), 0, 10),
      reasons: Array.isArray(j.reasons) ? j.reasons.map(String).slice(0, 5) : [],
      risks: Array.isArray(j.risks) ? j.risks.map(String).slice(0, 5) : [],
    }
  } catch (e: any) {
    console.warn('  ⚠️ AI 输出解析失败，用保守默认分：', String(e).slice(0, 120))
    return { demand: 5, competition: 6, bundle: 0, reasons: [], risks: ['AI 输出解析失败'] }
  }
}

main().catch((e) => {
  console.error('❌ 选品 Agent 失败：', e?.message || e)
  process.exit(1)
})

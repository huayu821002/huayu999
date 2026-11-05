/**
 * 选品 Agent —— CLI：给选出来的款批量生成上架资料
 *
 * 用法：
 *   node --experimental-strip-types scripts/selection-agent/enrich-cli.ts \
 *     --input enriched.json --out enriched.out.json
 *
 * 输入（enriched.json）：选品报告里 selected[] 的数组，或
 *   [{ title, cost, sellPrice, category, description, colors, variants, bundleNote }]
 */

import fs from 'node:fs'
import path from 'node:path'
import { enrichProduct } from '../../lib/selection/enrich.ts'
import { MODELS } from '../../lib/selection/ai.ts'

function parseArgs(argv: string[]) {
  const out: any = { model: MODELS.main, concurrency: 2 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input' || a === '-i') out.input = argv[++i]
    else if (a === '--out' || a === '-o') out.output = argv[++i]
    else if (a === '--model') out.model = argv[++i]
    else if (a === '--concurrency') out.concurrency = parseInt(argv[++i]) || 2
    else if (a === '--limit') out.limit = parseInt(argv[++i]) || 999
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.input) {
    console.error('用法: node --experimental-strip-types scripts/selection-agent/enrich-cli.ts --input selected.json [--out out.json]')
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(args.input, 'utf8'))
  const items: any[] = Array.isArray(raw) ? raw : raw.selected || []
  const list = items.slice(0, args.limit)

  console.log(`📝 生成资料 ${list.length} 个｜模型 ${args.model}`)

  const results: any[] = []
  let done = 0
  // 串行偏保守，但资料生成是写库前的关键步骤；并发 2 是平衡
  const queue = [...list]
  const workers = Array.from({ length: Math.min(args.concurrency, queue.length) }, async () => {
    while (queue.length) {
      const it = queue.shift()!
      try {
        const r = await enrichProduct(
          {
            title: it.title,
            cost: it.economics?.cost ?? it.cost,
            sellPrice: it.economics?.sellPrice ?? it.sellPrice,
            category: it.category,
            description: it.description,
            colors: it.colors,
            variants: it.variants,
            bundleNote:
              it.bundleNote ||
              (it.scores?.bundle >= 7 ? '该款套装潜力高，请在文案中强调可与同色系帽/围巾/手套成套' : undefined),
          },
          { model: args.model }
        )
        done++
        console.log(`  [${done}/${list.length}] ✅ ${String(it.title).slice(0, 34)} → ${r.titleEn.slice(0, 50)}`)
        results.push({ ...it, enriched: r })
      } catch (e: any) {
        done++
        console.log(`  [${done}/${list.length}] ❌ ${String(it.title).slice(0, 34)} → ${String(e?.message || e).slice(0, 80)}`)
        results.push({ ...it, error: String(e?.message || e).slice(0, 200) })
      }
    }
  })
  await Promise.all(workers)

  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true })
    fs.writeFileSync(args.output, JSON.stringify(results, null, 2))
    console.log(`\n💾 已写入 ${args.output}`)
  }

  const sample = results.find((r) => r.enriched)
  if (sample) {
    console.log('\n===== 样例 =====')
    console.log('标题:', sample.enriched.titleEn)
    console.log('SEO :', sample.enriched.seoTitle)
    console.log('短描述:', sample.enriched.shortDescEn)
    console.log('关键词:', sample.enriched.keywords.join(' | '))
    console.log('脚本:', sample.enriched.videoScript.slice(0, 160), '…')
  }
}

main().catch((e) => {
  console.error('❌ 资料生成失败：', e?.message || e)
  process.exit(1)
})

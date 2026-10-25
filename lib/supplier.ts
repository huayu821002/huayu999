import { prisma } from '@/lib/prisma'
import { scrubPIIValue, PII_API_RE } from '@/lib/pii'

/**
 * 采集品（1688 等供应商商品）的数据模型与工具。
 *
 * 说明：表结构通过 ensureSupplierProductTable() 自愈式创建，
 * 避免必须先在 Supabase 控制台手工执行 DDL。
 */

export type SupplierStatus = 'pending' | 'approved' | 'published' | 'rejected'

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "SupplierProduct" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT '1688',
  "sourceId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "title" TEXT NOT NULL,
  "titleCn" TEXT,
  "titleEn" TEXT,
  "seoTitle" TEXT,
  "keywords" TEXT,
  "shortDescEn" TEXT,
  "descriptionEn" TEXT,
  "firstSku" TEXT,
  "sourceSkuId" TEXT,
  "wholesalePrice" DOUBLE PRECISION,
  "priceLadder" TEXT,
  "skuPrices" TEXT,
  "description" TEXT,
  "images" TEXT,
  "videoUrl" TEXT,
  "priceMin" DOUBLE PRECISION,
  "priceMax" DOUBLE PRECISION,
  "moq" INTEGER,
  "unit" TEXT,
  "skuText" TEXT,
  "attributes" TEXT,
  "variants" TEXT,
  "variantDims" TEXT,
  "supplierName" TEXT,
  "supplierUrl" TEXT,
  "shippingText" TEXT,
  "raw" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "productId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierProduct_source_sourceId_key" ON "SupplierProduct"("source", "sourceId");
CREATE INDEX IF NOT EXISTS "SupplierProduct_status_createdAt_idx" ON "SupplierProduct"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SupplierProduct_source_sourceId_idx" ON "SupplierProduct"("source", "sourceId");
`

let tableReady = false

/** 新增字段（老表自愈） */
const ADD_COLUMNS = [
  ['titleEn', 'TEXT'],
  ['seoTitle', 'TEXT'],
  ['keywords', 'TEXT'],
  ['shortDescEn', 'TEXT'],
  ['descriptionEn', 'TEXT'],
  ['firstSku', 'TEXT'],
  ['sourceSkuId', 'TEXT'],
  ['wholesalePrice', 'DOUBLE PRECISION'],
  ['priceLadder', 'TEXT'],
  ['skuPrices', 'TEXT'],
  ['variants', 'TEXT'],
  ['variantDims', 'TEXT'],
]

/**
 * 确保采集品表存在。
 * 首次访问时若表缺失（P2021），自动执行 CREATE TABLE IF NOT EXISTS。
 */
export async function ensureSupplierProductTable(): Promise<void> {
  if (tableReady) return
  // 先补列（幂等 ALTER）：新增列还没建时，prisma 查询会直接报「列不存在」，
  // 所以必须先 ALTER 再查，否则第一次访问就会 500。
  await addMissingColumns()
  try {
    await prisma.supplierProduct.count()
    tableReady = true
    return
  } catch (err: any) {
    const code = err?.code || err?.meta?.code
    if (code !== 'P2021') throw err
  }

  const statements = CREATE_TABLE_SQL
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql)
  }
  tableReady = true
  await addMissingColumns()
}

/** 给已存在的表补齐新列（幂等） */
async function addMissingColumns(): Promise<void> {
  const failed: string[] = []
  for (const [col, type] of ADD_COLUMNS) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "SupplierProduct" ADD COLUMN IF NOT EXISTS "${col}" ${type}`
      )
    } catch (e: any) {
      // 列已存在或权限不足时忽略，但记下来便于排查
      failed.push(`${col}(${e?.message || e})`)
      console.warn(`[supplier] ADD COLUMN "${col}" 失败:`, e?.message || e)
    }
  }
  if (failed.length) {
    console.error('[supplier] 以下新列未能创建，采集品列表可能报错:', failed.join('; '))
  }
}

export interface SupplierProductInput {
  source?: string
  sourceId: string
  sourceUrl?: string
  title: string
  titleCn?: string
  titleEn?: string
  seoTitle?: string
  keywords?: string
  shortDescEn?: string
  descriptionEn?: string
  firstSku?: string
  sourceSkuId?: string
  wholesalePrice?: number | null
  priceLadder?: string
  skuPrices?: string
  description?: string
  images?: string[]
  videoUrl?: string
  priceMin?: number | null
  priceMax?: number | null
  moq?: number | null
  unit?: string
  skuText?: string
  attributes?: Record<string, any>
  /** 变体明细：[{ skuId, specs:[{name,value}], color, size, price, priceText, image }] */
  variants?: any[]
  /** 变体维度定义：[{ name, kind:'color'|'size'|'custom', values:[...] }] */
  variantDims?: any[]
  supplierName?: string
  supplierUrl?: string
  shippingText?: string
  raw?: any
}

function toJson(v: any): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

/** 写入或更新一条采集品（按 source + sourceId 去重） */
export async function upsertSupplierProduct(input: SupplierProductInput) {
  await ensureSupplierProductTable()

  const source = input.source || '1688'
  const sourceId = String(input.sourceId)

  // 仅包含本次实际提供的字段，避免二次采集覆盖掉已有数据
  const provided: any = {
    source,
    sourceId,
    sourceUrl: input.sourceUrl,
    title: input.title?.slice(0, 500),
    titleCn: input.titleCn,
    titleEn: input.titleEn,
    seoTitle: input.seoTitle,
    keywords: input.keywords,
    shortDescEn: input.shortDescEn,
    descriptionEn: input.descriptionEn,
    firstSku: input.firstSku,
    sourceSkuId: input.sourceSkuId,
    wholesalePrice: input.wholesalePrice,
    priceLadder: input.priceLadder,
    skuPrices: input.skuPrices,
    description: input.description,
    images: input.images !== undefined ? toJson(input.images) : undefined,
    videoUrl: input.videoUrl,
    priceMin: input.priceMin,
    priceMax: input.priceMax,
    moq: input.moq,
    unit: input.unit,
    skuText: input.skuText !== undefined ? toJson(input.skuText) : undefined,
    attributes: input.attributes !== undefined ? toJson(input.attributes) : undefined,
    variants: input.variants !== undefined ? toJson(input.variants) : undefined,
    variantDims: input.variantDims !== undefined ? toJson(input.variantDims) : undefined,
    supplierName: input.supplierName,
    supplierUrl: input.supplierUrl,
    shippingText: input.shippingText,
    raw: input.raw !== undefined ? toJson(input.raw) : undefined,
  }

  const updateData: any = {}
  for (const [k, v] of Object.entries(provided)) {
    if (v !== undefined) updateData[k] = v
  }
  updateData.updatedAt = new Date()

  const createData: any = { ...provided }
  for (const k of Object.keys(createData)) {
    if (createData[k] === undefined) createData[k] = null
  }
  createData.title = createData.title || '(untitled)'
  createData.status = 'pending'

  return prisma.supplierProduct.upsert({
    where: { source_sourceId: { source, sourceId } },
    create: createData,
    update: updateData,
  })
}

export function parseImagesField(images: string | null): string[] {
  if (!images) return []
  try {
    const parsed = JSON.parse(images)
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String)
    if (typeof parsed === 'string') return [parsed]
    return []
  } catch {
    return images.split(',').map(s => s.trim()).filter(Boolean)
  }
}

export function parseJsonField<T = any>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

/* ---------------------------------------------------------------------------
 * 存量 PII 清洗（2026-10-24）
 *
 * 早期版本的采集器把 1688 详情页的「收货地址簿」报文一起采集了，
 * 于是当前登录用户的真实姓名、手机号、收货地址被写进了 SupplierProduct.raw。
 * 采集端与服务端入库两道防线已经补上，这里再把历史存量洗一遍。
 *
 * 幂等：每个进程只跑一次；且只改「确实含个人信息」的行。
 * ------------------------------------------------------------------------- */
let piiCleanupDone = false

export async function scrubStoredRawPII(): Promise<number> {
  if (piiCleanupDone) return 0
  piiCleanupDone = true
  try {
    const rows = await prisma.supplierProduct.findMany({
      select: { id: true, raw: true },
    })
    let cleaned = 0
    for (const row of rows) {
      const raw = row.raw
      if (!raw || typeof raw !== 'string') continue
      if (!/1[3-9]\d{9}|mobilePhone|fullName|receiveaddress|addressItems/.test(raw)) continue
      let parsed: any
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = raw
      }
      const next = scrubPIIValue(parsed, 0)
      const nextText = typeof next === 'string' ? next : JSON.stringify(next)
      if (nextText !== raw) {
        await prisma.supplierProduct.update({
          where: { id: row.id },
          data: { raw: nextText },
        })
        cleaned++
      }
    }
    if (cleaned > 0) {
      console.log(`[supplier] 已清洗 ${cleaned} 条采集记录中的个人信息`)
    }
    return cleaned
  } catch (e: any) {
    console.error('[supplier] 存量 PII 清洗失败（不影响主流程）:', e?.message || e)
    return 0
  }
}

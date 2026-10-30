import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/* ------------------------------------------------------------------ *
 * 启动时幂等补列（2026-10-28）
 *
 * 背景：生产库的表结构是用 `prisma db push` 建的，**没有 prisma/migrations
 * 历史**，所以 `prisma migrate deploy` 跑不了；而在 build 脚本里加 db push
 * 有「结构漂移就 destructive」的风险，不敢动现有部署流程。
 *
 * 折中：应用启动时执行一次 **幂等** 的 ALTER TABLE ... IF NOT EXISTS。
 *   - 只补「schema 里新加、库里还没有」的列
 *   - 幂等 → 每次启动都跑也安全
 *   - 失败静默 → 绝不影响应用启动
 *
 * 用法：ensureColumn('Product', 'sourceUrl', 'TEXT')
 * ------------------------------------------------------------------ */

const ensured = new Set<string>()

export async function ensureColumn(
  table: string,
  column: string,
  type: string = 'TEXT'
): Promise<boolean> {
  const key = `${table}.${column}`
  if (ensured.has(key)) return true
  // 只允许简单标识符，防注入
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
    return false
  }
  // type 也要白名单：它是直接拼进 SQL 的（表名/列名已经用正则卡住了，
  // 但 type 之前没校验 —— 万一将来有人把用户输入当 type 传进来就是注入）
  if (!/^(TEXT|VARCHAR|INTEGER|BIGINT|BOOLEAN|TIMESTAMP|DATE|JSONB|NUMERIC|DECIMAL|FLOAT|DOUBLE PRECISION|SERIAL|BIGSERIAL)$/i.test(type)) {
    return false
  }
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}`
    )
    ensured.add(key)
    return true
  } catch (e: any) {
    // 生产库账号可能没有 ALTER 权限 → 静默跳过，不阻塞启动
    console.warn(`[prisma] ensureColumn(${key}) 失败：${e?.message || e}`)
    return false
  }
}

/** 启动时自动补齐的列清单 */
const STARTUP_COLUMNS: Array<[string, string, string]> = [
  ['Product', 'sourceUrl', 'TEXT'],
  ['Product', 'sourceSkuId', 'TEXT'],
]

let startupEnsured: Promise<void> | null = null

export function ensureStartupColumns(): Promise<void> {
  if (!startupEnsured) {
    startupEnsured = (async () => {
      for (const [t, c, ty] of STARTUP_COLUMNS) {
        await ensureColumn(t, c, ty)
      }
    })()
  }
  return startupEnsured
}

// 进程启动时自动跑一次（fire-and-forget）
if (process.env.NODE_ENV !== 'test') {
  void ensureStartupColumns()
}

/**
 * 把远程图片下载到本地空间
 *
 * 需求（2026-10-26）：采集后的图片，后台「生成上架」时自动下载到本地，
 * 商品的图片地址改用本地路径 —— 不再依赖 1688 CDN（防盗链 + 对方可能删图）。
 *
 * 关键点：
 *  ① 阿里 CDN **有防盗链**：带外站 Referer 一律 403。
 *     实测（2026-10-25）：
 *       curl -H "Referer: https://fiestaflare.com/"  cbu01.alicdn.com/... → 403
 *       curl （无 Referer）                                    → 200
 *     → 下载时**绝对不能带 Referer**。
 *  ② 落地目录必须是**持久目录**（部署不会清空），用 PERSISTENT_UPLOAD_DIR。
 *  ③ 文件名用 URL 的哈希（内容不变 → 文件名不变 → 天然去重、幂等）。
 *  ④ 已经是本地的图（/api/uploads/...）直接跳过。
 *  ⑤ 下载失败**不阻塞上架** —— 保留原 CDN 地址，至少还能显示。
 */

import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { createHash } from 'crypto'

/** 持久上传目录（部署后不会被清空） */
export const PERSISTENT_UPLOAD_DIR = '/home/u828392799/domains/fiestaflare.com/uploads'

/**
 * 实际落地目录（按优先级）。
 *  1) UPLOAD_DIR 环境变量（显式指定）
 *  2) 持久目录 PERSISTENT_UPLOAD_DIR（生产环境）
 *  3) public/uploads（本地开发 / CI 没权限时）
 *
 * 注意：这里只做「选目录」，**能不能写由写入时的 try/catch 决定** ——
 * 目录存在 ≠ 可写（生产环境可能是只读挂载）。
 */
export function resolveUploadDir(): string {
  const env = process.env.UPLOAD_DIR
  if (env) return env
  return PERSISTENT_UPLOAD_DIR
}

/** 备选目录（持久目录写不进去时用） */
export function fallbackUploadDir(): string {
  return path.join(process.cwd(), 'public', 'uploads')
}

/** 本地图片的访问前缀（与 app/api/uploads/[filename]/route.ts 对应） */
export const LOCAL_IMAGE_PREFIX = '/api/uploads/'

/**
 * 站点基础地址（用于把本地图拼成**完整网站地址**）
 * 用户需求（2026-10-26 第 3 条）：「图片地址用网站地址」
 * → 存 https://fiestaflare.com/api/uploads/xxx.jpg 而不是 /api/uploads/xxx.jpg
 * 好处：分享/外链/邮件/SEO 场景都能直接用，不用猜相对路径相对于谁。
 */
export function siteBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  const base = (env || 'https://fiestaflare.com').replace(/\/+$/, '')
  return base
}

/** 本地图片的完整网站地址 */
export function localImageUrl(filename: string): string {
  return `${siteBaseUrl()}${LOCAL_IMAGE_PREFIX}${filename}`
}

/** 是不是本地图（相对或绝对都认） */
export function isLocalImageUrl(url: string): boolean {
  const u = String(url || '')
  if (!u) return false
  if (u.startsWith(LOCAL_IMAGE_PREFIX)) return true
  try {
    const parsed = new URL(u)
    return parsed.pathname.startsWith(LOCAL_IMAGE_PREFIX)
  } catch {
    return false
  }
}

/** 允许下载的域名（白名单，防 SSRF） */
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'cbu01.alicdn.com', 'cbu02.alicdn.com', 'cbu03.alicdn.com', 'cbu04.alicdn.com',
  'cbu05.alicdn.com', 'cbu06.alicdn.com', 'cbu07.alicdn.com', 'cbu08.alicdn.com',
  'cbu09.alicdn.com', 'cbu10.alicdn.com', 'cbu11.alicdn.com', 'cbu12.alicdn.com',
  'cbu13.alicdn.com', 'cbu14.alicdn.com', 'cbu15.alicdn.com',
  'img.alicdn.com', 'img.alicdn.com.cn', 'gd1.alicdn.com', 'gd2.alicdn.com',
  'gd3.alicdn.com', 'gd4.alicdn.com', 'gw.alicdn.com', 'sc01.alicdn.com',
  'sc02.alicdn.com', 'sc03.alicdn.com', 'sc04.alicdn.com', 'image.1688.com',
  'img.1688.com', 'cbu01.1688.com', 'ay1-cbu01.alicdn.com', 'ay2-cbu01.alicdn.com',
  'ay3-cbu01.alicdn.com', 'ay4-cbu01.alicdn.com', 'ay5-cbu01.alicdn.com',
  'item.alicdn.com', 's1.timg.cn',
])

/** 是不是已经落地的本地图片 */
export function isLocalImage(url: string): boolean {
  return isLocalImageUrl(url)
}

/** 从 URL 猜扩展名（只认常见图片类型） */
function extFromUrl(url: string): string {
  const clean = url.split('?')[0]
  const m = clean.match(/\.(jpg|jpeg|png|webp|gif)(?:_|$)/i)
  if (m) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
  return 'jpg'
}

/**
 * 下载一张远程图到本地，返回本地 URL。
 * 失败返回 null（调用方决定是否降级）。
 */
export async function downloadImageToLocal(
  remoteUrl: string,
  opts: { timeoutMs?: number } = {}
): Promise<string | null> {
  if (!remoteUrl) return null
  // 已经是本地的 → 不用下
  if (isLocalImage(remoteUrl)) return remoteUrl
  // 站内相对路径 → 不动
  if (remoteUrl.startsWith('/') && !remoteUrl.startsWith('//')) return remoteUrl

  let parsed: URL
  try {
    parsed = new URL(remoteUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (!ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname)) return null

  const ext = extFromUrl(remoteUrl)
  // 文件名用 URL 哈希 → 内容不变文件名不变 → 天然幂等 + 去重
  const hash = createHash('sha1').update(parsed.pathname).digest('hex').slice(0, 20)
  const filename = `${hash}.${ext}`
  const uploadDir = resolveUploadDir()
  const filepath = path.join(uploadDir, filename)

  // 已经下过了
  if (existsSync(filepath)) {
    try {
      const st = await readFile(filepath)
      if (st.length > 0) return localImageUrl(filename)
    } catch { /* 落到下面重新下载 */ }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000)
  try {
    // ★ 不带 Referer（阿里 CDN 防盗链，带了 403）
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FiestaflareBot/1.0)',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    // 阿里 CDN 出错时返回 1x1 的 GIF（HTTP 200），要识别出来
    if (!/^image\//i.test(contentType)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // 1x1 GIF / 空文件 → 视为失败
    if (buf.length < 1024) return null
    if (buf.slice(0, 3).toString('latin1') === 'GIF') return null

    // 写入：优先持久目录，失败（没权限/只读）→ 回退到 public/uploads
    for (const dir of [uploadDir, fallbackUploadDir()]) {
      try {
        if (!existsSync(dir)) await mkdir(dir, { recursive: true })
        await writeFile(path.join(dir, filename), buf)
        return localImageUrl(filename)
      } catch {
        // 试下一个目录
      }
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 批量下载（并发上限 4，避免把服务器打满）。
 * 返回与入参等长的数组，失败的位置是 null。
 */
export async function downloadImagesToLocal(
  urls: string[],
  opts: { concurrency?: number; timeoutMs?: number } = {}
): Promise<(string | null)[]> {
  const list = Array.isArray(urls) ? urls : []
  const out: (string | null)[] = new Array(list.length).fill(null)
  const conc = Math.max(1, Math.min(opts.concurrency ?? 4, 8))
  let cursor = 0
  const workers = Array.from({ length: Math.min(conc, list.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= list.length) return
      try {
        out[i] = await downloadImageToLocal(list[i], { timeoutMs: opts.timeoutMs })
      } catch {
        out[i] = null
      }
    }
  })
  await Promise.all(workers)
  return out
}

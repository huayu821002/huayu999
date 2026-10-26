import { normalizeAlibabaImage } from '@/lib/imageNormalize'

/**
 * 1688 / 阿里 CDN 图片代理
 *
 * 背景（2026-10-25 实测）：
 *   curl -H "Referer: https://fiestaflare.com/"  cbu01.alicdn.com/...  → **403**
 *   curl                                                   (无 Referer)  → 200
 *   curl -H "Referer: https://detail.1688.com/"  cbu01.alicdn.com/...  → 200
 *   → 阿里 CDN 有**防盗链**，外站 Referer 一律 403。
 *   → 站内所有从 1688 采来的图片（主图/图集/变体图）全都裂了。
 *
 * 方案：服务端代理转发（不带外站 Referer），前端只认 /api/img?u=...
 *
 * 安全：
 *   - 只允许白名单里的 CDN 域名（防 SSRF：不能拿这个接口去打内网/任意地址）
 *   - 限制路径形态
 *   - 结果缓存 7 天（immutable）
 */

/** 允许代理的 CDN 域名 */
export const ALLOWED_IMAGE_HOSTS = new Set([
  'cbu01.alicdn.com',
  'cbu02.alicdn.com',
  'cbu03.alicdn.com',
  'cbu04.alicdn.com',
  'cbu05.alicdn.com',
  'cbu06.alicdn.com',
  'cbu07.alicdn.com',
  'cbu08.alicdn.com',
  'cbu09.alicdn.com',
  'cbu10.alicdn.com',
  'img.alicdn.com',
  'img.alicdn.com.cn',
  'gd1.alicdn.com',
  'gd2.alicdn.com',
  'gd3.alicdn.com',
  'gd4.alicdn.com',
  'gw.alicdn.com',
  'img.alicdn.com',
  'sc04.alicdn.com',
  'sc01.alicdn.com',
  'sc02.alicdn.com',
  'sc03.alicdn.com',
  'sc04.alicdn.com',
  'image.1688.com',
  'img.1688.com',
  'cbu01.1688.com',
  'ay1-cbu01.alicdn.com',
  'ay1-cbu02.alicdn.com',
  'ay1-cbu03.alicdn.com',
  'ay2-cbu01.alicdn.com',
  'ay2-cbu02.alicdn.com',
  'ay3-cbu01.alicdn.com',
  'ay3-cbu02.alicdn.com',
  'ay4-cbu01.alicdn.com',
  'ay5-cbu01.alicdn.com',
  'ay6-cbu01.alicdn.com',
  'ay7-cbu01.alicdn.com',
  'ay1-cbu04.alicdn.com',
  'ay2-cbu03.alicdn.com',
  'ay3-cbu03.alicdn.com',
  'ay4-cbu02.alicdn.com',
  'ay5-cbu02.alicdn.com',
  'ay6-cbu02.alicdn.com',
  'ay7-cbu02.alicdn.com',
  'ay8-cbu01.alicdn.com',
  'ay9-cbu01.alicdn.com',
  'cbu11.alicdn.com',
  'cbu12.alicdn.com',
  'cbu13.alicdn.com',
  'cbu14.alicdn.com',
  'cbu15.alicdn.com',
  'item.alicdn.com',
  'img.alicdn.com.cn',
  's1.timg.cn',
  'img.alicdn.com',
])

/** 站点自身的图片不走代理 */
const LOCAL_PREFIXES = ['/uploads', '/images', '/img', '/api/uploads', '/api/images', 'data:', 'blob:', 'http://localhost', 'http://127.0.0.1']

/**
 * 站点自身域名下的本地图（绝对地址）也不走代理。
 * 本地图存的是完整网站地址（https://fiestaflare.com/api/uploads/xxx.jpg），
 * 不能因为以后有人把主域名加进 ALLOWED_IMAGE_HOSTS 就被套上代理。
 */
function isOwnSiteLocalImage(u: string): boolean {
  if (!u.startsWith('http://') && !u.startsWith('https://')) return false
  try {
    const parsed = new URL(u)
    const host = parsed.hostname.toLowerCase()
    const isOwn = host === 'fiestaflare.com' || host === 'www.fiestaflare.com' || host === 'localhost' || host === '127.0.0.1'
    if (!isOwn) return false
    return parsed.pathname.startsWith('/api/uploads/') || parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/images/')
  } catch {
    return false
  }
}

/**
 * 把 1688/阿里 CDN 的图片 URL 转成代理 URL；其它 URL 原样返回。
 * 已经是代理 URL 的不重复套娃。
 */
export function proxyImage(url: string | null | undefined): string {
  const u = String(url || '').trim()
  if (!u) return ''
  if (u.startsWith('/api/img')) return u
  if (LOCAL_PREFIXES.some(p => u.startsWith(p))) return u
  if (isOwnSiteLocalImage(u)) return u
  let parsed: URL
  try {
    parsed = new URL(u)
  } catch {
    return u // 相对路径 / 非法 URL，原样返回
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return u
  const host = parsed.hostname.toLowerCase()
  if (!ALLOWED_IMAGE_HOSTS.has(host)) return u
  return `/api/img?u=${encodeURIComponent(u)}`
}

/** 批量处理数组里的图片字段 */
export function proxyImageList(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list.map(x => proxyImage(String(x || ''))).filter(Boolean)
}

/**
 * 处理 DB 里的 images 字段。
 * 它可能是 JSON 字符串（'["url1","url2"]'）、逗号分隔字符串、或已经是数组。
 * 返回同形态的代理后值；解析不了就原样返回。
 */
export function proxyImagesField(images: unknown): unknown {
  if (images === null || images === undefined) return images
  if (Array.isArray(images)) return proxyImageList(images)

  const s = String(images).trim()
  if (!s) return images
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s)
      if (Array.isArray(arr)) return JSON.stringify(proxyImageList(arr))
      return images
    } catch {
      return images
    }
  }
  // 逗号分隔
  if (s.includes(',')) {
    const parts = s.split(',').map(x => x.trim()).filter(Boolean)
    if (parts.length) return proxyImageList(parts).join(',')
  }
  // 单个 URL
  return proxyImage(s)
}

/**
 * ★ 反向：把代理 URL 还原成原始 CDN URL。
 *
 * 背景：后台编辑页加载到的是代理 URL（`/api/img?u=...`），
 * 保存时如果原样写回 DB，DB 里就存了代理 URL —— 以后再代理就套不上、
 * 换域名也全都失效。
 * → **DB 只存原始 URL，代理只发生在读取时。**
 * 所以所有写入路径都要先 unproxy。
 */
export function unproxyImage(url: string | null | undefined): string {
  const u = String(url || '').trim()
  if (!u) return ''
  if (!u.startsWith('/api/img')) return u
  const m = u.match(/[?&]u=([^&]+)/)
  if (!m) return u
  try {
    return decodeURIComponent(m[1])
  } catch {
    return u
  }
}

/** 反向处理 images 字段（JSON 字符串 / 数组 / 逗号分隔） */
export function unproxyImagesField(images: unknown): any {
  if (images === null || images === undefined) return images
  if (Array.isArray(images)) return images.map((x: any) => unproxyImage(String(x || '')))
  const s = String(images).trim()
  if (!s) return images
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s)
      if (Array.isArray(arr)) return JSON.stringify(arr.map((x: any) => unproxyImage(String(x || ''))))
      return images
    } catch {
      return images
    }
  }
  if (s.includes(',')) {
    return s.split(',').map(x => unproxyImage(x.trim())).filter(Boolean).join(',')
  }
  return unproxyImage(s)
}

/** 反向处理变体数组里的 image */
export function unproxyVariantImages<T extends Record<string, any>>(variants: T[]): T[] {
  if (!Array.isArray(variants)) return variants
  return variants.map(v => {
    if (!v || typeof v !== 'object') return v
    const out: any = { ...v }
    if ('image' in out) out.image = out.image ? unproxyImage(out.image) : out.image
    if (Array.isArray(out.images)) out.images = out.images.map((x: any) => unproxyImage(String(x || '')))
    return out as T
  })
}

/**
 * 把产品对象上的所有图片字段（images / modelImage / sizeChart）换成代理 URL。
 * 浅拷贝，不改原对象。
 */
export function withProxiedImages<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj
  const out: any = { ...obj }
  // ★ 先归一化成原图（剥掉 _sum 等缩略后缀，80x80 → 800x800），再走代理
  //   注意：**保持输入形态**（JSON 字符串进 → JSON 字符串出），不改变 API 契约
  if ('images' in out) {
    const raw = out.images
    if (Array.isArray(raw)) {
      out.images = proxyImageList(raw.map(x => normalizeAlibabaImage(String(x || ''))))
    } else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) {
          out.images = JSON.stringify(proxyImageList(arr.map(x => normalizeAlibabaImage(String(x || '')))))
        }
      } catch { /* 不是合法 JSON，交给 proxyImagesField 原样处理 */ }
      if (out.images === raw) out.images = proxyImagesField(raw)
    } else {
      out.images = proxyImage(normalizeAlibabaImage(String(raw || '')))
    }
  }
  if ('modelImage' in out) out.modelImage = proxyImage(normalizeAlibabaImage(out.modelImage))
  if ('sizeChart' in out) out.sizeChart = proxyImage(normalizeAlibabaImage(out.sizeChart))
  return out as T
}

/**
 * 变体数组：每个变体的 image 换成代理 URL。
 * 同时兼容 image / images 两种形态。
 */
export function withProxiedVariantImages<T extends Record<string, any>>(variants: T[]): T[] {
  if (!Array.isArray(variants)) return variants
  return variants.map(v => {
    if (!v || typeof v !== 'object') return v
    const out: any = { ...v }
    // ★ 变体图：先归一化成**原图**（剥掉 _sum 等缩略后缀，80x80 → 800x800），再走代理
    //   这里是所有变体图对外输出的唯一出口 → 在这里兜底，历史数据不用重刷也生效
    if ('image' in out) {
      out.image = out.image ? proxyImage(normalizeAlibabaImage(out.image)) : out.image
    }
    if (Array.isArray(out.images)) out.images = proxyImageList(out.images.map((x: any) => normalizeAlibabaImage(String(x || ''))))
    return out as T
  })
}

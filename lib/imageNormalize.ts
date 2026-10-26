/**
 * 1688 / 阿里 CDN 图片 URL 归一化 —— **拿原图，不拿缩略图**
 *
 * 真实实测（2026-10-26，线上商品 O1CN013HiT1U2Gvmd6BcB0m_!!2222432059078-0-cib）：
 *   xxx.jpg_sum.jpg            →  80x80     1896 B   ← _sum = 缩略图！
 *   xxx.jpg                    → 800x800   87715 B   ← 原图
 *   xxx.jpg_1200x1200.jpg      → 800x800（源图就 800，钳回）
 *   xxx.jpg_1600x1600.jpg      → 404
 *
 * 结论：**规则是「剥掉所有缩略/裁剪后缀」，不是「加尺寸参数」**。
 * 源图上限 800×800（1688 商品主图就是这样），再大也没有。
 *
 * 与前端内核 `normImage()` 保持一致（前端是双保险，这里是最后一道）。
 */

/** 阿里/1688 图床域名 */
const ALICDN_HOST_RE = /(alicdn|1688|taobao|cbu|timg)\./i

/**
 * 把一个图片 URL 归一成「原图」URL。
 * 不是阿里图床、或本来就不是 URL 的，原样返回。
 */
export function normalizeAlibabaImage(input: unknown): string {
  let url = String(input ?? '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) return url
  if (!ALICDN_HOST_RE.test(url)) return url

  // 去掉 query（阿里图床的缩略参数都在 query 里，如 ?x-oss-process=image/resize,w_200）
  url = url.split('?')[0]

  // .jpg_.webp → .jpg
  url = url.replace(/\.(jpg|jpeg|png|webp)_\.(webp|jpg|jpeg|png)$/i, '.$1')

  // 反复剥后缀，直到不动点（可能叠多层：xxx.jpg_100x100xz.jpg_sum.jpg）
  let prev = ''
  let guard = 0
  while (url !== prev && guard++ < 10) {
    prev = url
    // 尺寸后缀
    url = url.replace(/_\d+x\d+(xz)?\.(jpg|jpeg|png|webp)$/i, '')
    url = url.replace(/_\d+x\d+(xz)?_(webp|jpg|jpeg|png)$/i, '')
    // 1688 缩略图后缀 _sum（整段删，_sum 在扩展名之前）
    url = url.replace(/_sum\.(jpg|jpeg|png|webp)$/i, '')
    url = url.replace(/_sum$/i, '')
    // 其它常见阿里缩略后缀
    url = url.replace(/_(?:thumb|mini|small|reduced)\.(jpg|jpeg|png|webp)$/i, '')
    url = url.replace(/_(?:thumb|mini|small|reduced)$/i, '')
  }

  // 保证还有扩展名
  if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(url)) {
    if (/[a-z0-9]$/i.test(url)) url += '.jpg'
  }
  return url
}

/** 批量归一化，过滤空值 */
export function normalizeAlibabaImageList(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const x of list) {
    const u = normalizeAlibabaImage(x)
    if (u) out.push(u)
  }
  return out
}

/** 把 JSON 字符串形式的图片数组归一化（DB 里 images 存的是 JSON 字符串） */
export function normalizeAlibabaImagesField(field: unknown): string | null {
  if (field === null || field === undefined || field === '') return null
  if (Array.isArray(field)) {
    const arr = normalizeAlibabaImageList(field)
    return arr.length ? JSON.stringify(arr) : null
  }
  const s = String(field).trim()
  if (!s) return null
  // 可能是 JSON 数组字符串
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) {
        const arr = normalizeAlibabaImageList(parsed)
        return arr.length ? JSON.stringify(arr) : null
      }
    } catch {
      // 不是合法 JSON，当作单张图处理
    }
  }
  const one = normalizeAlibabaImage(s)
  return one || null
}

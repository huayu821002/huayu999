/**
 * 隐私脱敏（服务端 + 采集端共用逻辑）。
 *
 * 背景（2026-10-24）：1688 商品详情页除了商品数据，还会同时请求
 *   mtop.1688.trade.receiveaddress.queryReceiveAddresses
 * —— 里面是当前登录用户的**真实收货地址、姓名、手机号**。
 * 早期版本的采集器把它当成页面数据一起采集、推送、入库，
 * 等于把用户本人的住址和手机号存进了我们自己的数据库。
 *
 * 三道防线：
 *   1) 采集端：命中个人地址簿接口的报文直接丢弃（见 scripts/1688-core.src.js）
 *   2) 服务端：入库前 scrub（见 app/api/import/1688/route.ts）
 *   3) 存量清理：scrubStoredRawPII() 一次性清洗历史行
 */

/** 精确字段名（整段匹配才命中，避免误伤 addressCode / addressCount 这类无害字段） */
const PII_EXACT_KEYS = new Set([
  'address', 'addressdetail', 'mobile', 'mobilephone', 'phone', 'phonenumber',
  'tel', 'telephone', 'fullname', 'realname', 'idcard', 'idnumber', 'identity',
  'bankcard', 'bankaccount', 'recipient', 'consignee', 'receiver', 'email',
  'password', 'passwd', 'weixin', 'wechat', 'qq',
  // 账号信息（1688 登录态）
  'nick', 'loginid', 'loginname', 'username', 'userid', 'membername', 'account',
  'user', 'member', 'buyer',
])

/** 包含即命中的字段名 */
const PII_KEY_RE =
  /(mobilePhone|phoneNumber|idCard|idNumber|bankCard|bankAccount|addressDetail|userAddress|addressCodeText|postalCode|realName|fullName)/i

/** 个人地址簿 / 账号信息类接口 */
export const PII_API_RE =
  /(receiveaddress|addresslist|address\.query|userinfo|userprofile|memberinfo|myorder|orderlist|buyerinfo|getusersimple|mtop\.user\.|logincenter|usercenter|passport)/i

export function isPIIKey(k: unknown): boolean {
  const key = String(k ?? '')
  if (PII_KEY_RE.test(key)) return true
  return PII_EXACT_KEYS.has(key.toLowerCase())
}

/** 自由文本里的手机号 / 座机 / 身份证 掩码 */
export function maskPII(s: string): string {
  return String(s)
    .replace(/(?<!\d)(1[3-9]\d{9})(?!\d)/g, '1**********')
    .replace(/(?<!\d)(\d{3,4}-\d{7,8})(?!\d)/g, '***-********')
    .replace(/(?<!\d)(\d{17}[\dXx])(?!\d)/g, '******************')
}

/** 递归脱敏：敏感字段整块替换，自由文本做掩码 */
export function scrubPIIValue(node: any, depth = 0): any {
  if (depth > 12) return node
  if (typeof node === 'string') return maskPII(node)
  if (Array.isArray(node)) return node.map((x) => scrubPIIValue(x, depth + 1))
  if (node && typeof node === 'object') {
    const out: Record<string, any> = {}
    for (const k of Object.keys(node)) {
      const v = node[k]
      if (isPIIKey(k)) {
        out[k] = typeof v === 'string' && v === '' ? '' : '[已脱敏]'
      } else {
        out[k] = scrubPIIValue(v, depth + 1)
      }
    }
    return out
  }
  return node
}

/**
 * 脱敏一条采集记录：除了字段级脱敏，还把地址簿报文整块删掉。
 */
export function scrubPIIItem(item: any): any {
  if (!item || typeof item !== 'object') return item
  let obj = item
  const raw = obj.raw
  if (raw && typeof raw === 'object') {
    const clone: any = { ...raw }
    if (Array.isArray(clone.snapshot)) {
      clone.snapshot = clone.snapshot.filter((s: any) => !PII_API_RE.test(String(s?.url || '')))
    }
    if (Array.isArray(clone.captured)) {
      clone.captured = clone.captured.filter((s: any) => !PII_API_RE.test(String(s?.url || '')))
    }
    if (Array.isArray(clone.capturedUrls)) {
      clone.capturedUrls = clone.capturedUrls.filter((u: string) => !PII_API_RE.test(String(u || '')))
    }
    obj = { ...obj, raw: clone }
  }
  return scrubPIIValue(obj, 0)
}

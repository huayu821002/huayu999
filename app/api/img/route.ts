import { NextRequest, NextResponse } from 'next/server'
import { ALLOWED_IMAGE_HOSTS } from '@/lib/imgProxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/img?u=<encoded 1688/阿里 CDN 图片 URL>
 *
 * 为什么需要（2026-10-25 实测）：
 *   curl -H "Referer: https://fiestaflare.com/"  cbu01.alicdn.com/... → **403**
 *   curl                                                   (无 Referer)  → 200
 *   curl -H "Referer: https://detail.1688.com/"  cbu01.alicdn.com/... → 200
 *   → 阿里 CDN 有**防盗链**，外站 Referer 一律 403。
 *   → 站内所有从 1688 采来的图片（主图/图集/变体图）全裂。
 *
 * 这里服务端转发（Referer 指向 1688，或干脆不带），前端只认 /api/img?u=...
 *
 * 安全：
 *   - 域名白名单（防 SSRF：不能借这个接口打内网/任意地址）
 *   - 禁 IP 字面量 / localhost / 非 http(s)
 *   - 30s 超时 + 20MB 上限
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('u') || ''
  if (!raw) {
    return new NextResponse('missing u', { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return new NextResponse('bad url', { status: 400 })
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return new NextResponse('bad protocol', { status: 400 })
  }
  const host = target.hostname.toLowerCase()
  if (!ALLOWED_IMAGE_HOSTS.has(host)) {
    return new NextResponse('host not allowed', { status: 403 })
  }
  // 白名单都是域名，理论上不含 IP，但再挡一次
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    return new NextResponse('ip not allowed', { status: 403 })
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 30_000)
  try {
    const upstream = await fetch(target.toString(), {
      signal: ac.signal,
      headers: {
        // 防盗链只认 1688 自己的 Referer
        Referer: 'https://detail.1688.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
      cache: 'no-store',
    })

    if (!upstream.ok) {
      return new NextResponse(`upstream ${upstream.status}`, { status: 502 })
    }

    const type = upstream.headers.get('content-type') || 'image/jpeg'
    // 只透传图片类型，防上游返回 html 错误页被当图片缓存
    if (!/^image\//i.test(type)) {
      return new NextResponse('not an image', { status: 415 })
    }

    const buf = await upstream.arrayBuffer()
    if (buf.byteLength > 20 * 1024 * 1024) {
      return new NextResponse('too large', { status: 413 })
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Content-Length': String(buf.byteLength),
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-FF-Img-Proxy': '1',
      },
    })
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'timeout' : 'fetch failed'
    return new NextResponse(msg, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}

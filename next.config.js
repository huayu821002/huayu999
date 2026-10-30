const { symlinkSync, existsSync, mkdirSync, unlinkSync } = require('fs')
const path = require('path')

/**
 * ★ 2026-10-30 安全加固：next/image 的 remotePatterns 原来是 hostname: '**'
 *   —— 任何人都能拿我们的图片优化器当**任意 https 站点的取件代理**（SSRF），
 *   并且可以把它打到磁盘缓存写满（Next 官方 CVE：GHSA-9g9p-9gw9 / GHSA-3x4c-7xq6）。
 * 现在改成显式白名单：只允许站内域名 + 1688/阿里 CDN + seed 用的 unsplash。
 * 新增图片源时记得往这里加域名，否则 next/image 会拒绝加载。
 */
const ALLOWED_REMOTE_IMAGE_HOSTS = [
  'fiestaflare.com',
  'www.fiestaflare.com',
  'images.unsplash.com',
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
  'cbu11.alicdn.com',
  'cbu12.alicdn.com',
  'cbu13.alicdn.com',
  'cbu14.alicdn.com',
  'cbu15.alicdn.com',
  'img.alicdn.com',
  'img.alicdn.com.cn',
  'gd1.alicdn.com',
  'gd2.alicdn.com',
  'gd3.alicdn.com',
  'gd4.alicdn.com',
  'gw.alicdn.com',
  'sc01.alicdn.com',
  'sc02.alicdn.com',
  'sc03.alicdn.com',
  'sc04.alicdn.com',
  'item.alicdn.com',
  'image.1688.com',
  'img.1688.com',
  'cbu01.1688.com',
  's1.timg.cn',
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 白名单（而不是 '**'）：见文件顶部说明
    remotePatterns: ALLOWED_REMOTE_IMAGE_HOSTS.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
    // 不允许 SVG（可内嵌脚本）
    dangerouslyAllowSVG: false,
    // 只输出 WebP：避开 Next 图片优化器在处理 AVIF/SVG 时的 RCE 面
    formats: ['image/webp'],
    // 走我们自己的 /api/img 代理的图已经是现成的字节流，不需要再优化一次
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    // Hostinger 共享主机进程数受限，静态生成 worker 并发太多会 EAGAIN（spawn worker failed）
    cpus: 2,
  },
  // ★ 2026-10-30 安全加固：统一安全响应头。
  //   为什么放在这里：middleware 不处理静态资源，而这里是全局唯一能覆盖所有路径的地方。
  //   刻意不加 Content-Security-Policy：PayPal JS SDK 与页面内联脚本会被 CSP 打断。
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  // Build 后自动创建 uploads 符号链接，指向持久化目录
  after: async () => {
    const persistentUploads = '/home/u828392799/domains/fiestaflare.com/uploads'
    const nodejsDir = path.join(__dirname)
    const publicUploads = path.join(nodejsDir, 'public', 'uploads')

    // 确保持久目录存在
    if (!existsSync(persistentUploads)) {
      mkdirSync(persistentUploads, { recursive: true })
    }

    // 如果 public/uploads 已存在（build 复制的空目录），删掉换成符号链接
    if (existsSync(publicUploads)) {
      const stat = require('fs').statSync(publicUploads)
      if (stat.isDirectory()) {
        // 删掉空目录，创建符号链接
        require('child_process').execSync(`rm -rf "${publicUploads}" && ln -s "${persistentUploads}" "${publicUploads}"`)
      }
    }
  },
}

module.exports = nextConfig

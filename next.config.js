const { symlinkSync, existsSync, mkdirSync, unlinkSync } = require('fs')
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
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

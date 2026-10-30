import { NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { verifyToken } from '@/lib/auth'
import { randomUUID } from 'crypto'

import { resolveUploadDir } from '@/lib/localImages'

/** 文件名随机前缀（防重名 + 防路径穿越） */
function cryptoSafeId(): string {
  return randomUUID()
}

export async function POST(request: Request) {
  try {
    // 验证用户身份
    // ★ 2026-10-30 安全修复：原来只要任意有效 JWT（普通客户也能传任意文件）。
    //   现在收紧为仅 ADMIN —— 文件上传会写入服务端磁盘并可被公开 URL 访问，
    //   客户账号不应该有这个能力。
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Allowed: JPG, PNG, GIF, WEBP, DOCX' }, { status: 400 })
    }

    // 32MB max
    if (file.size > 32 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large. Max 32MB' }, { status: 400 })
    }

    // 生成唯一文件名（DOCX 保留原名以便直接访问）
    // ★ 2026-10-30 安全修复：原来 DOCX 分支直接用 `file.name` 落盘，
    //   而 file.name 完全由客户端控制 → 形如 `../../../../public/evil.js` 的文件名
    //   可以**写到上传目录之外**（任意文件写）。现在一律做 basename + 扩展名白名单。
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const isDoc = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const safeExt = isDoc ? 'docx' : (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg')
    const baseName = path.basename(file.name || '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
    const filename = isDoc
      ? `${cryptoSafeId()}-${baseName.endsWith('.docx') ? baseName : baseName + '.docx'}`
      : `${cryptoSafeId()}.${safeExt}`

    // 上传到持久目录（部署后不会被清空）
    const uploadDir = resolveUploadDir()
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filepath = path.join(uploadDir, filename)
    await writeFile(filepath, buffer)

    // 返回相对路径，前端通过 /api/uploads/xxx 访问
    const url = `/api/uploads/${filename}`

    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: 'Failed to process file' }, { status: 500 })
  }
}

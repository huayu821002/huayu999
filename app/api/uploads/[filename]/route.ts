import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const PERSISTENT_UPLOAD_DIR = '/home/u828392799/domains/fiestaflare.com/uploads'

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename
    // 防止路径穿越攻击
    if (filename.includes('..') || filename.includes('/')) {
      return new NextResponse('Invalid filename', { status: 400 })
    }

    const filepath = path.join(PERSISTENT_UPLOAD_DIR, filename)

    // 安全检查：确保文件在允许的目录内
    if (!filepath.startsWith(PERSISTENT_UPLOAD_DIR)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    if (!existsSync(filepath)) {
      return new NextResponse('Not found', { status: 404 })
    }

    const buffer = await readFile(filepath)
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
    const contentType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving uploaded file:', error)
    return new NextResponse('Error', { status: 500 })
  }
}

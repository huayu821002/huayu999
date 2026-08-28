import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Allowed: JPG, PNG, GIF, WEBP' }, { status: 400 })
    }

    // 32MB max
    if (file.size > 32 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large. Max 32MB' }, { status: 400 })
    }

    // 上传到 imgbb（永久存储，不受部署影响）
    const imgbbApiKey = process.env.IMGBB_API_KEY
    if (!imgbbApiKey) {
      return NextResponse.json({ success: false, error: 'Image upload service not configured' }, { status: 500 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const imgbbFormData = new FormData()
    imgbbFormData.append('image', base64)
    imgbbFormData.append('key', imgbbApiKey)

    const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: imgbbFormData,
    })

    if (!imgbbResponse.ok) {
      console.error('imgbb upload failed:', await imgbbResponse.text())
      return NextResponse.json({ success: false, error: 'Failed to upload image' }, { status: 500 })
    }

    const imgbbResult = await imgbbResponse.json()
    
    if (!imgbbResult.success) {
      return NextResponse.json({ success: false, error: 'Image upload failed' }, { status: 500 })
    }

    // 返回 imgbb 的 URL
    const url = imgbbResult.data.url

    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: 'Failed to process file' }, { status: 500 })
  }
}

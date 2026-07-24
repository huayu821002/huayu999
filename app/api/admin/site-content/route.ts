import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const content = await prisma.siteContent.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ success: true, data: content })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch content' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { section, title, subtitle, content, isActive, sortOrder } = body

    // Upsert - update if exists, create if not
    const existing = await prisma.siteContent.findUnique({ where: { section } })
    if (existing) {
      const updated = await prisma.siteContent.update({
        where: { section },
        data: { title, subtitle, content, isActive, sortOrder: sortOrder || 0 },
      })
      return NextResponse.json({ success: true, data: updated })
    } else {
      const created = await prisma.siteContent.create({
        data: { section, title, subtitle, content, isActive: isActive !== false, sortOrder: sortOrder || 0 },
      })
      return NextResponse.json({ success: true, data: created })
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Failed to save content' }, { status: 500 })
  }
}

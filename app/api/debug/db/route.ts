import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const userCount = await prisma.user.count()
    return NextResponse.json({ 
      success: true, 
      userCount,
      message: 'Database connected'
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error),
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_POSTGRES_URL,
        dbUrlPreview: process.env.DATABASE_POSTGRES_URL?.substring(0, 30) + '...'
      }
    }, { status: 500 })
  }
}

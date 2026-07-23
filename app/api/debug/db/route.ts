import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Test basic connection
    await prisma.$connect()
    const userCount = await prisma.user.count()
    return NextResponse.json({ 
      success: true, 
      userCount,
      message: 'Database connected successfully'
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message || String(error),
      code: error.code,
      name: error.name
    }, { status: 500 })
  }
}

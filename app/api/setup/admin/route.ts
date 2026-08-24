import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Require SETUP_SECRET header
    const setupSecret = request.headers.get('x-setup-secret')
    if (process.env.SETUP_SECRET && setupSecret !== process.env.SETUP_SECRET) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    })

    if (existingAdmin && !force) {
      return NextResponse.json(
        { success: false, error: 'Admin already exists. Use ?force=true to reset password (requires x-setup-secret header).' },
        { status: 409 }
      )
    }

    const email = 'admin@fiestaflare.com'
    const password = 'admin123'
    const hashedPassword = await bcrypt.hash(password, 10)

    if (existingAdmin && force) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: hashedPassword, email, role: 'ADMIN' },
      })
      return NextResponse.json({ success: true, message: 'Admin password reset' })
    }

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Admin',
        role: 'ADMIN',
      },
    })

    return NextResponse.json({ success: true, message: 'Admin created' })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}

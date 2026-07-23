import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function POST() {
  try {
    const email = 'admin@fiestaflare.com'
    const password = 'admin123'
    const hashedPassword = await bcrypt.hash(password, 10)

    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    })

    if (existingAdmin) {
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword, role: 'ADMIN' },
      })
      return NextResponse.json({ success: true, message: 'Admin updated' })
    }

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Admin',
        role: 'ADMIN',
        company: 'Fiestaflare',
      },
    })

    return NextResponse.json({ success: true, message: 'Admin created' })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ success: false, error: 'Setup failed' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET /api/site/addresses - Get current user's addresses
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const addresses = await prisma.address.findMany({
      where: { userId: user.userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    })

    return NextResponse.json({ success: true, data: addresses })
  } catch (error) {
    console.error('Get addresses error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch addresses' }, { status: 500 })
  }
}

// POST /api/site/addresses - Create new address
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { label, firstName, lastName, email, phone, street, city, state, country, zipCode, isDefault } = body

    // If this is set as default, unset other defaults first
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.userId },
        data: { isDefault: false },
      })
    }

    const address = await prisma.address.create({
      data: {
        userId: user.userId,
        label: label || '',
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || '',
        phone: phone || '',
        street: street || '',
        city: city || '',
        state: state || '',
        country: country || '',
        zipCode: zipCode || '',
        isDefault: isDefault || false,
      },
    })

    return NextResponse.json({ success: true, data: address })
  } catch (error) {
    console.error('Create address error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create address' }, { status: 500 })
  }
}

// PUT /api/site/addresses - Update address
export async function PUT(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { id, label, firstName, lastName, email, phone, street, city, state, country, zipCode, isDefault } = body

    // Verify address belongs to user
    const existing = await prisma.address.findFirst({
      where: { id, userId: user.userId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 })
    }

    // If this is set as default, unset other defaults first
    if (isDefault && !existing.isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.userId },
        data: { isDefault: false },
      })
    }

    const address = await prisma.address.update({
      where: { id },
      data: {
        label: label ?? existing.label,
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        street: street ?? existing.street,
        city: city ?? existing.city,
        state: state ?? existing.state,
        country: country ?? existing.country,
        zipCode: zipCode ?? existing.zipCode,
        isDefault: isDefault ?? existing.isDefault,
      },
    })

    return NextResponse.json({ success: true, data: address })
  } catch (error) {
    console.error('Update address error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update address' }, { status: 500 })
  }
}

// DELETE /api/site/addresses - Delete address
export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Address ID required' }, { status: 400 })
    }

    // Verify address belongs to user
    const existing = await prisma.address.findFirst({
      where: { id, userId: user.userId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 })
    }

    await prisma.address.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete address error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete address' }, { status: 500 })
  }
}

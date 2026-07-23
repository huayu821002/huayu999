import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@fiestaflare.com'
  const password = 'admin123'
  const hashedPassword = await bcrypt.hash(password, 10)

  // Check if admin exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email },
  })

  if (existingAdmin) {
    console.log('Admin user already exists')
    // Update password to ensure it's correct
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, role: 'ADMIN' },
    })
    console.log('Admin password updated')
  } else {
    // Create admin user
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Admin',
        role: 'ADMIN',
        company: 'Fiestaflare',
      },
    })
    console.log('Admin user created')
  }

  // Also create test customer if not exists
  const customerEmail = 'customer@test.com'
  const existingCustomer = await prisma.user.findUnique({
    where: { email: customerEmail },
  })

  if (!existingCustomer) {
    const customerPassword = await bcrypt.hash('customer123', 10)
    await prisma.user.create({
      data: {
        email: customerEmail,
        password: customerPassword,
        name: 'Test Customer',
        role: 'CUSTOMER',
      },
    })
    console.log('Test customer created')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
